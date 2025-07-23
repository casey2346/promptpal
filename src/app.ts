// src/app.ts
import express from "express";
import dotenv from "dotenv";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import client from "prom-client";
import swaggerUi from "swagger-ui-express";
import YAML from "yamljs";
import os from "os";
import jwtAuth from "./middleware/auth";
import * as Sentry from "@sentry/node";
import i18n from "./middleware/i18n";
import { Queue, Worker, Job } from "bullmq";
import Arena from "bull-arena";
import { loadModel, getModelInfo, switchModel } from "./services/modelLoader";
import { createRouter } from "./routes";
import { healthCheck } from "./routes/health";
import { logStartup, logError } from "./utils/logger";
import path from "path";
import multer from "multer";
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';

// OpenTelemetry
import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { JaegerExporter } from "@opentelemetry/exporter-jaeger";
import { diag, DiagConsoleLogger, DiagLogLevel } from "@opentelemetry/api";

// Setup telemetry
// Setup telemetry
const ENV = process.env.NODE_ENV || "development";
dotenv.config({ path: `.env.${ENV}` });
const PORT = process.env.PORT || 8080;
console.log("🔧 ENV:", ENV, "| PORT:", PORT, "| Sentry DSN:", process.env.SENTRY_DSN);

diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.ERROR);

const sdk = new NodeSDK({
  traceExporter: new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces'
  }),
  instrumentations: [getNodeAutoInstrumentations()]
});


// Start tracing inside async bootstrap
async function initTracing() {
  try {
    await sdk.start();
    console.log("📈 OpenTelemetry tracing started.");
  } catch (err) {
    console.error("❌ OpenTelemetry failed to start:", err);
  }
}


// Setup Express
const app = express();
app.use(express.json());

// Setup Sentry
Sentry.init({
  dsn: process.env.SENTRY_DSN || "",
  environment: ENV,
});
app.use(Sentry.Handlers.requestHandler());

// Middleware
app.use(i18n);
const allowedOrigins = (process.env.CORS_ORIGINS || "").split(",");
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) callback(null, true);
      else callback(new Error("Not allowed by CORS"));
    },
  })
);
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        "default-src": ["'self'"],
        "img-src": ["'self'", "data:"],
        "script-src": ["'self'", "'unsafe-inline'"],
      },
    },
  })
);
app.use(morgan("dev"));

// Rate limiting
app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: 100,
  })
);

// Prometheus metrics
client.collectDefaultMetrics();
const httpRequestDurationMicroseconds = new client.Histogram({
  name: "http_request_duration_ms",
  help: "Duration of HTTP requests in ms",
  labelNames: ["method", "route", "status_code"],
  buckets: [50, 100, 300, 500, 1000, 2000],
});
app.use((req, res, next) => {
  const end = httpRequestDurationMicroseconds.startTimer();
  res.on("finish", () => end({ method: req.method, route: req.path, status_code: res.statusCode }));
  next();
});

// Swagger docs
const swaggerDocument = YAML.load("./docs/openapi.yaml");
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Health check
app.get("/health", healthCheck);
app.get("/ready", (_req, res) => res.send("OK"));
app.get("/status", (_req, res) => res.status(200).send("OK"));
app.get("/test", (_req, res) => res.status(200).json({ status: "Test endpoint working" }));
app.get("/version", (_req, res) => {
  res.json({
    name: "PromptPal AI Backend",
    version: process.env.APP_VERSION || "1.0.0",
    commit: process.env.GIT_COMMIT || "unknown",
    env: ENV,
    uptime: process.uptime().toFixed(2),
    sentry: !!process.env.SENTRY_DSN,
    tracing: true,
  });
});

// BullMQ
let modelInstance: any = null;
const inferenceQueue = new Queue("inference", { connection: { host: "localhost", port: 6379 } });
const inferenceWorker = new Worker("inference", async (job: Job) => {
  if (modelInstance && job.data.input) return await modelInstance.infer(job.data.input);
  throw new Error("Model not loaded or invalid input");
}, { connection: { host: "localhost", port: 6379 } });

const arena = Arena({
  BullMQ: Queue,
  queues: [{ type: "bullmq", name: "inference", hostId: "PromptPalQueue", connection: { host: "localhost", port: 6379 } }],
}, { basePath: "/admin/arena", disableListen: true });
app.use("/admin/arena", arena);

// File Upload (Model)
const upload = multer({ dest: "uploads/" });
app.post("/api/model/upload", jwtAuth, upload.single("model"), async (req, res) => {
  try {
    const path = req.file?.path;
    if (!path) return res.status(400).send("Model file missing");
    const newModel = await loadCustomModel(path); 
    modelInstance = newModel;
    res.send("Model uploaded and loaded.");
  } catch (err) {
    logError("Model upload failed", err);
    res.status(500).send("Upload failed.");
  }
});


// Inference endpoints
app.post("/api/infer", jwtAuth, async (req, res) => {
  const transaction = Sentry.startTransaction({ name: "POST /api/infer" });
  try {
    const result = await modelInstance.infer(req.body.input);
    res.json({ result });
  } catch (e) {
    Sentry.captureException(e);
    res.status(500).json({ error: "Inference failed" });
  } finally {
    transaction.finish();
  }
});

// Bootstrap
async function bootstrap() {
  try {
    console.time("Model loaded in");
    modelInstance = await loadModel();
    console.timeEnd("Model loaded in");

    app.use("/api", jwtAuth, createRouter(modelInstance));

    const server = app.listen(PORT, () => {
      logStartup(`\ud83d\ude80 ${ENV.toUpperCase()} AI Server Ready at http://localhost:${PORT}`);
      console.log("\ud83d\udd27 Host:", os.hostname());
      console.log("\ud83d\udcc6 Platform:", process.platform, process.arch);
      console.log("\ud83e\udde0 Memory:", (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2), "MB");
      console.log("\ud83d\udd52 Uptime:", process.uptime().toFixed(2), "s");
      console.log("\ud83d\udd39 Commit:", process.env.GIT_COMMIT || "unknown");
      console.log("\ud83d\udee1\ufe0f Sentry:", process.env.SENTRY_DSN ? "enabled" : "disabled");
    });

    process.on("SIGINT", async () => {
      console.log("\ud83d\udd0c Shutting down gracefully...");
      await inferenceWorker.close();
      await inferenceQueue.close();
      server.close(() => {
        console.log("\u2705 Server closed");
        sdk.shutdown().then(() => {
          console.log("\ud83e\uddf9 OpenTelemetry shutdown complete.");
          process.exit(0);
        });
      });
    });

    process.on("unhandledRejection", (reason) => logError("UNHANDLED REJECTION:", reason));
    process.on("uncaughtException", (error) => {
      logError("UNCAUGHT EXCEPTION:", error);
      process.exit(1);
    });

  } catch (error: any) {
    logError("\u274c Startup failed", error);
    process.exit(1);
  }
}

// Error Handling
app.use((_req, res) => res.status(404).json({ error: "Not found" }));
app.use(Sentry.Handlers.errorHandler());
app.use((err: any, _req: any, res: any, _next: any) => {
  logError("Global Error Handler:", err);
  res.status(500).json({ error: "Internal server error" });
});

bootstrap();
function loadCustomModel(path: string) {
    throw new Error("Function not implemented.");
}


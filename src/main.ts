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
import jwtAuth from "./middleware/auth.js";
import * as Sentry from "@sentry/node";
import i18n from "./middleware/i18n.js";
import { Queue, Worker, Job } from "bullmq";
const Arena = require("bull-arena");
import { loadModel, getModelInfo, switchModel } from "./services/modelLoader.js";
import { createRouter } from "./routes/index.js"; 
import { healthCheck } from "./routes/health.js";
import { logStartup, logError } from "./utils/logger.js";


import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { JaegerExporter } from "@opentelemetry/exporter-jaeger";
import { diag, DiagConsoleLogger, DiagLogLevel } from "@opentelemetry/api";
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';

diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.ERROR);

const sdk = new NodeSDK({
  traceExporter: new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces',
  }),
  instrumentations: [getNodeAutoInstrumentations()],
});


try {
  sdk.start();
  console.log("📈 OpenTelemetry tracing started.");
} catch (err) {
  console.error("Failed to start OpenTelemetry:", err);
}

const ENV = process.env.NODE_ENV || "development";
dotenv.config({ path: `.env.${ENV}` });
const PORT = process.env.PORT || 8080;

const app = express();
app.use(express.json());

Sentry.init({
  dsn: process.env.SENTRY_DSN || "",
  environment: ENV,
});

app.use(Sentry.Handlers.requestHandler());

app.use(i18n);

const allowedOrigins = (process.env.CORS_ORIGINS || "").split(",");
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) callback(null, true);
    else callback(new Error("Not allowed by CORS"));
  },
}));
app.use(helmet());
app.use(morgan("dev"));

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
});
app.use(limiter);

client.collectDefaultMetrics();
const httpRequestDurationMicroseconds = new client.Histogram({
  name: "http_request_duration_ms",
  help: "Duration of HTTP requests in ms",
  labelNames: ["method", "route", "status_code"],
  buckets: [50, 100, 300, 500, 1000, 2000],
});
app.use((req, res, next) => {
  const end = httpRequestDurationMicroseconds.startTimer();
  res.on("finish", () => {
    end({ method: req.method, route: req.path, status_code: res.statusCode });
  });
  next();
});

app.get("/metrics", async (_req, res) => {
  res.set("Content-Type", client.register.contentType);
  res.end(await client.register.metrics());
});

const swaggerDocument = YAML.load("./docs/openapi.yaml");
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.get("/health", healthCheck);
app.get("/ready", (_req, res) => res.send("OK"));
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

let modelInstance: any = null;
const inferenceQueue = new Queue("inference", { connection: { host: "localhost", port: 6379 } });
const inferenceWorker = new Worker("inference", async (job: Job) => {
  if (modelInstance && job.data.input) return await modelInstance.infer(job.data.input);
  throw new Error("Model not loaded or invalid input");
}, { connection: { host: "localhost", port: 6379 } });

const arena = Arena({
  BullMQ: Queue,
  queues: [{
    type: "bullmq",
    name: "inference",
    hostId: "PromptPalQueue",
    connection: { host: "localhost", port: 6379 },
  }],
}, { basePath: "/admin/arena", disableListen: true });
app.use("/admin/arena", arena);

async function bootstrap() {
  try {
    console.time("Model loaded in");
    modelInstance = await loadModel();
    console.timeEnd("Model loaded in");

    app.use("/api", jwtAuth, createRouter(modelInstance));

    app.post("/api/infer/batch", jwtAuth, async (req, res) => {
      try {
        const { inputs } = req.body;
        if (!Array.isArray(inputs)) return res.status(400).json({ error: req.t("invalid_input") });
        const outputs = await Promise.all(inputs.map(modelInstance.infer));
        res.json({ results: outputs });
      } catch (err) {
        logError("Batch infer error", err);
        res.status(500).json({ error: req.t("batch_infer_fail") });
      }
    });

    app.get("/api/info", jwtAuth, (_req, res) => res.json(getModelInfo(modelInstance)));

    app.post("/api/infer/queue", jwtAuth, async (req, res) => {
      const { input } = req.body;
      if (!input) return res.status(400).json({ error: "Missing input" });
      const job = await inferenceQueue.add("infer", { input });
      res.json({ jobId: job.id });
    });

    app.post("/api/model/switch", jwtAuth, async (req, res) => {
      try {
        const { modelType } = req.body;
        modelInstance = await switchModel(modelType);
        res.json({ status: "Model switched", modelType });
      } catch (err) {
        logError("Switch model failed", err);
        res.status(500).json({ error: "Model switch failed" });
      }
    });

    const server = app.listen(PORT, () => {
      logStartup(`🚀 ${ENV.toUpperCase()} AI Server Ready at http://localhost:${PORT}`);
      console.log("🔧 Host:", os.hostname());
      console.log("📦 Platform:", process.platform, process.arch);
      console.log("🧠 Memory:", (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2), "MB");
      console.log("🕒 Uptime:", process.uptime().toFixed(2), "s");
      console.log("📌 Commit:", process.env.GIT_COMMIT || "unknown");
      console.log("🛡️ Sentry:", process.env.SENTRY_DSN ? "enabled" : "disabled");
    });

    process.on("SIGINT", () => {
      console.log("🚩 SIGINT received, shutting down...");
      server.close(() => {
        console.log("✅ Server closed");
        sdk.shutdown().then(() => {
          console.log("🧹 OpenTelemetry shutdown complete.");
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
    logError("❌ Startup failed", error);
    process.exit(1);
  }
}

// Global error handling
app.use((_req, res) => res.status(404).json({ error: "Not found" }));
app.use(Sentry.Handlers.errorHandler());
app.use((err: any, _req: any, res: any, _next: any) => {
  logError("Global Error Handler:", err);
  res.status(500).json({ error: "Internal server error" });
});

bootstrap();

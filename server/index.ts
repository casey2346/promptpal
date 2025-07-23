// server/index.ts

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import { register } from 'prom-client';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import path from 'path';
import morgan from 'morgan';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import { execSync } from 'child_process';

import { logger } from '../src/utils/logger';
import { setupOpenTelemetry, shutdownTracing } from '../src/utils/tracing';
import { setupSentry } from '../src/utils/sentry';
import apiRouter from '../src/routes/api';
import { registerSocketHandlers } from '../src/sockets';

// Load env variables
dotenv.config();

// Warn if critical environment variables are missing
if (!process.env.OPENAI_API_KEY || !process.env.PORT) {
  logger.warn('⚠️ Some required environment variables are missing');
}

// Initialize Express
const app = express();
const httpServer = createServer(app);
const io = new SocketServer(httpServer, { cors: { origin: '*' } });

// Middleware
app.use(cors());
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request ID middleware
app.use((req, res, next) => {
  let requestId = req.headers['x-request-id'];

  if (!requestId || Array.isArray(requestId)) {
    requestId = uuidv4();
  }
  const finalRequestId = requestId as string;

  req.headers['x-request-id'] = finalRequestId;
  res.setHeader('x-request-id', finalRequestId);
  next();
});


// Observability
setupOpenTelemetry();
setupSentry(app);

// Rate limiting
app.use(
  rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 100,
    message: 'Too many requests from this IP, please try again later.',
  })
);

// Prometheus metrics
app.get('/metrics', async (_req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// Health check
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

// Version info
app.get('/version', (_req, res) => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf-8'));
  let gitCommit = 'N/A';
  try {
    gitCommit = execSync('git rev-parse HEAD').toString().trim();
  } catch (err) {
    logger.warn('Git commit hash not available');
  }
  res.status(200).json({ version: packageJson.version, commit: gitCommit });
});

// Log upload endpoint
app.post('/logs', (req, res) => {
  const logData = req.body;
  logger.info('📥 Log received from client:', logData);
  res.status(200).json({ status: 'log received' });
});

// Swagger docs
const swaggerDocument = YAML.load(path.join(__dirname, '../docs/swagger.yaml'));
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Static assets
app.use(express.static(path.join(__dirname, '../public')));

// API routes
app.use('/api', apiRouter);

// Fallback
app.use('*', (_req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

// Socket.IO with auth capability
registerSocketHandlers(io);

// Start server
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  logger.info(`🚀 Server running at http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('🛑 SIGTERM received. Shutting down gracefully...');
  await shutdownTracing();
  httpServer.close(() => process.exit(0));
});

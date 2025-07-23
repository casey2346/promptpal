// server/routes/logs.ts

import express from 'express';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { z } from 'zod';
import { verifyToken, RequestWithUser } from '../../src/utils/auth';
import { logger } from '../../src/utils/logger';
import { Counter } from 'prom-client';
import compression from 'compression';
import { summarizeLogsAI } from '../../src/services/aiSummary';

const router = express.Router();
const LOG_DIR = path.resolve('logs');
const LOG_FILE_PATH = path.join(LOG_DIR, 'app.log');

const logAccessCounter = new Counter({
  name: 'log_view_requests_total',
  help: 'Total number of log view attempts',
});

const logErrorCounter = new Counter({
  name: 'log_error_total',
  help: 'Total number of error-level log entries',
});

const requireAdmin = (req: RequestWithUser, res: express.Response, next: express.NextFunction) => {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  next();
};

const logQuerySchema = z.object({
  level: z.enum(['info', 'warn', 'error']).optional(),
  keyword: z.string().optional(),
  maxLines: z.coerce.number().min(1).max(1000).default(100),
  skip: z.coerce.number().min(0).default(0),
  tenantId: z.string().optional(),
});

/**
 * @swagger
 * /logs/view:
 *   get:
 *     summary: View logs with filters
 *     tags: [Logs]
 *     parameters:
 *       - in: query
 *         name: level
 *         schema:
 *           type: string
 *           enum: [info, warn, error]
 *       - in: query
 *         name: keyword
 *         schema:
 *           type: string
 *       - in: query
 *         name: maxLines
 *         schema:
 *           type: number
 *           default: 100
 *       - in: query
 *         name: skip
 *         schema:
 *           type: number
 *           default: 0
 *     responses:
 *       200:
 *         description: Filtered logs
 *       400:
 *         description: Invalid query
 *       403:
 *         description: Admin access required
 */
router.get('/view', verifyToken, requireAdmin, async (req, res) => {
  logAccessCounter.inc();
  try {
    const { level, keyword, maxLines, skip, tenantId } = logQuerySchema.parse(req.query);
    const filePath = tenantId ? path.join(LOG_DIR, `app-${tenantId}.log`) : LOG_FILE_PATH;
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Log file not found' });

    const lines: string[] = [];
    const rl = readline.createInterface({ input: fs.createReadStream(filePath), crlfDelay: Infinity });
    let count = 0;
    for await (const line of rl) {
      const matchesLevel = !level || line.toLowerCase().includes(`[${level}]`);
      const matchesKeyword = !keyword || line.includes(keyword);
      if (matchesLevel && matchesKeyword) {
        if (count++ < skip) continue;
        lines.push(line);
        if (lines.length >= maxLines) break;
      }
    }
    return res.status(200).json({ lines });
  } catch (err) {
    logger.warn('Failed to read logs', err);
    return res.status(400).json({ error: 'Invalid query' });
  }
});

/**
 * @swagger
 * /logs/summary:
 *   get:
 *     summary: Get AI-generated summary of logs
 *     tags: [Logs]
 *     responses:
 *       200:
 *         description: Summary object
 */
router.get('/summary', verifyToken, requireAdmin, async (req, res) => {
  try {
    if (!fs.existsSync(LOG_FILE_PATH)) return res.status(404).json({ error: 'Log file not found' });
    const logs = fs.readFileSync(LOG_FILE_PATH, 'utf-8');
    const summary = await summarizeLogsAI(logs);
    return res.status(200).json({ summary });
  } catch (err) {
    logger.warn('Failed to summarize logs', err);
    return res.status(500).json({ error: 'Log summary failed' });
  }
});

/**
 * @swagger
 * /logs/download:
 *   get:
 *     summary: Download the full log file (gzipped)
 *     tags: [Logs]
 */
router.get('/download', verifyToken, requireAdmin, compression(), (req, res) => {
  if (!fs.existsSync(LOG_FILE_PATH)) return res.status(404).json({ error: 'Log file not found' });
  res.setHeader('Content-Disposition', 'attachment; filename=app.log.gz');
  res.setHeader('Content-Encoding', 'gzip');
  res.setHeader('Content-Type', 'text/plain');
  fs.createReadStream(LOG_FILE_PATH).pipe(res);
});

/**
 * @swagger
 * /logs/segments:
 *   get:
 *     summary: Get segmented log file by date
 *     tags: [Logs]
 */
router.get('/segments', verifyToken, requireAdmin, (req, res) => {
  const date = req.query.date as string;
  if (!date || !/\d{4}-\d{2}-\d{2}/.test(date)) {
    return res.status(400).json({ error: 'Invalid date format (YYYY-MM-DD)' });
  }
  const filePath = path.join(LOG_DIR, `app-${date}.log`);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Segment log not found' });
  res.setHeader('Content-Type', 'text/plain');
  fs.createReadStream(filePath).pipe(res);
});

/**
 * @swagger
 * /logs/stats:
 *   get:
 *     summary: Get log level statistics
 *     tags: [Logs]
 */
router.get('/stats', verifyToken, requireAdmin, async (req, res) => {
  try {
    if (!fs.existsSync(LOG_FILE_PATH)) return res.status(404).json({ error: 'Log file not found' });
    const rl = readline.createInterface({ input: fs.createReadStream(LOG_FILE_PATH), crlfDelay: Infinity });
    let info = 0, warn = 0, error = 0;
    for await (const line of rl) {
      if (line.includes('[info]')) info++;
      else if (line.includes('[warn]')) warn++;
      else if (line.includes('[error]')) error++;
    }
    return res.status(200).json({ stats: { info, warn, error } });
  } catch (err) {
    logger.error('Failed to compute log stats', err);
    return res.status(500).json({ error: 'Stats computation failed' });
  }
});

export default router;

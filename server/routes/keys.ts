// server/routes/keys.ts

import express from 'express';
import { z } from 'zod';
import { verifyToken, RequestWithUser } from '../../src/utils/auth';
import { logger } from '../../src/utils/logger';
import { redisKeyStoreService } from '../../src/services/keyStoreRedis';
import { Counter } from 'prom-client';
import rateLimit from 'express-rate-limit';

const router = express.Router();

// Prometheus metric
const keyValidationCounter = new Counter({
  name: 'api_key_validation_requests_total',
  help: 'Total number of API key validation attempts',
});

// Rate limit for /validate to prevent abuse
const validateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // max 30 req/min per IP
  message: 'Too many validation requests. Please try again shortly.',
});

// Zod schema
const apiKeySchema = z.object({
  key: z.string().min(10),
});

// 🔐 Only 'admin' users can register/revoke keys
const requireAdmin = (req: RequestWithUser, res: express.Response, next: express.NextFunction) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden: admin access required' });
  }
  next();
};

// 🚪 POST /keys/register - Protected
router.post('/register', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { key } = apiKeySchema.parse(req.body);
    const ip = req.ip;
    const username = (req as RequestWithUser).user?.username || 'unknown';

    const added = await redisKeyStoreService.registerKey(key);
    if (!added) return res.status(409).json({ error: 'Key already exists' });

    logger.info(`🔑 API key registered: ${key} by ${username} from ${ip}`);
    return res.status(201).json({ message: 'API key registered successfully' });
  } catch (err) {
    logger.warn('❌ Invalid key format', err);
    return res.status(400).json({ error: 'Invalid key format' });
  }
});

// 🔍 GET /keys/validate?key=xxx
router.get('/validate', validateLimiter, async (req, res) => {
  const { key } = req.query;
  const ip = req.ip;

  if (typeof key !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid key' });
  }

  keyValidationCounter.inc();
  logger.info(`🔍 API key validation attempt from IP: ${ip}`);

  const valid = await redisKeyStoreService.validateKey(key);
  return res.status(valid ? 200 : 403).json({
    valid,
    ...(valid ? {} : { error: 'Invalid key' }),
  });
});

// 🧹 DELETE /keys/revoke - Protected
router.delete('/revoke', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { key } = apiKeySchema.parse(req.body);
    const ip = req.ip;
    const username = (req as RequestWithUser).user?.username || 'unknown';

    const removed = await redisKeyStoreService.revokeKey(key);
    if (!removed) return res.status(404).json({ error: 'Key not found' });

    logger.info(`🗑️ API key revoked: ${key} by ${username} from ${ip}`);
    return res.status(200).json({ message: 'API key revoked successfully' });
  } catch (err) {
    return res.status(400).json({ error: 'Invalid key format' });
  }
});

export default router;

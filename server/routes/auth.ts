// server/routes/auth.ts

import express from 'express';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcrypt';
import { logger } from '../../src/utils/logger';
import { verifyToken } from '../../src/utils/auth';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'mock-secret';
const SALT_ROUNDS = 10;

// 🧪 Rate limiting for login
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: 'Too many login attempts. Please try again later.',
});

// 🔐 Schema for auth validation
const authSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(6),
});

// 📝 In-memory mock user store
const mockUserDB = new Map<string, { hash: string; role: string }>();

// 🚪 POST /auth/register
router.post('/register', async (req, res) => {
  try {
    const { username, password } = authSchema.parse(req.body);

    if (mockUserDB.has(username)) {
      return res.status(409).json({ error: 'User already exists' });
    }

    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    mockUserDB.set(username, { hash, role: 'user' });
    return res.status(201).json({ message: 'User registered successfully' });
  } catch (err) {
    logger.warn('🛑 Registration validation failed', err);
    return res.status(400).json({ error: 'Invalid input' });
  }
});

// 🚪 POST /auth/login
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { username, password } = authSchema.parse(req.body);
    const storedUser = mockUserDB.get(username);

    if (!storedUser || !(await bcrypt.compare(password, storedUser.hash))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ username, role: storedUser.role }, JWT_SECRET, { expiresIn: '1h' });

    return res.status(200).json({
      token,
      user: { name: username, role: storedUser.role },
    });
  } catch (err) {
    logger.warn('🛑 Login validation failed', err);
    return res.status(400).json({ error: 'Invalid input' });
  }
});

// 🔐 GET /auth/profile - Protected
router.get('/profile', verifyToken, (req, res) => {
  const user = (req as any).user; // added by verifyToken middleware
  return res.status(200).json({ user });
});

export default router;

// src/routes/api.ts

import express from 'express';
import { z } from 'zod';

const router = express.Router();

// Example GET /api/hello
router.get('/hello', (req, res) => {
  res.json({ message: 'Hello from API route!' });
});

// Example POST /api/echo with Zod validation
router.post('/echo', (req, res) => {
  const schema = z.object({
    name: z.string(),
    age: z.number().optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.errors });
  }

  res.json({ data: parsed.data });
});

export default router;

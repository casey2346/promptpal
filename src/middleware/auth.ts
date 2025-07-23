// src/middleware/auth.ts
import { Request, Response, NextFunction } from "express";

export default function jwtAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Missing token" });


  try {
    next();
  } catch (err) {
    res.status(401).json({ error: "Invalid token" });
  }
}

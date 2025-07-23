
import { Request, Response } from "express";

export function healthCheck(_req: Request, res: Response) {
  res.status(200).send("OK");
}

import { Router } from "express";

export function createRouter(modelInstance: any) {
  const router = Router();

  router.post("/infer", async (req, res) => {
    try {
      const { input } = req.body;
      if (!input) return res.status(400).json({ error: "Missing input" });
      const result = await modelInstance.infer(input);
      res.json({ result });
    } catch (err) {
      res.status(500).json({ error: "Inference failed" });
    }
  });

  return router;
}

// src/utils/loadTemplate.ts

import fs from "fs";

interface EditorSession {
  prompt: string;
  response: string;
  model: string;
  totalTokens: number;
  durationMs: number;
  fallbackUsed?: boolean;
  gptScoreBaseline?: number;
}

export function loadTemplateSessions(filePath: string): EditorSession[] {
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const sessions = JSON.parse(raw);

    if (!Array.isArray(sessions)) {
      throw new Error("Template JSON must be an array.");
    }

    return sessions.map(s => ({
      prompt: s.prompt,
      response: s.response,
      model: s.model,
      totalTokens: s.totalTokens,
      durationMs: s.durationMs,
      fallbackUsed: s.fallbackUsed ?? false,
      gptScoreBaseline: s.gptScoreBaseline,
    }));
  } catch (err) {
    console.error(`❌ Failed to load template file "${filePath}":`, err.message);
    return [];
  }
}

// src/utils/buildPrompt.ts

import { GeminiMessage } from "../types";

export function buildGeminiPrompt(messages: GeminiMessage[]): string {
  return messages.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join("\n") + "\nASSISTANT:";
}

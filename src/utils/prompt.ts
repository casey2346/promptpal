// src/utils/prompt.ts

import { ClaudeMessage } from "../api/claude";

/**
 * Build a prompt string compatible with Claude from a list of messages.
 * @param messages Claude-style message array
 * @returns Prompt string for Claude API
 */
export function buildClaudePrompt(messages: ClaudeMessage[]): string {
  return (
    messages.map((m) => `\n\n${m.role.toUpperCase()}: ${m.content}`).join("") +
    "\n\nASSISTANT:"
  );
}

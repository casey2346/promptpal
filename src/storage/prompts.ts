// src/storage/prompts.ts

export type PromptRole = "user" | "assistant" | "system";

export interface PromptMessage {
  role: PromptRole;
  content: string;
}

/**
 * Default system prompt for assistants.
 * Can be swapped per model in prompt builders.
 */
export const DEFAULT_SYSTEM_PROMPT = `You are a helpful, honest, and safe AI assistant.`;

/**
 * Templates for few-shot prompts or instruction formats.
 */
export const PromptTemplates = {
  gemini: (messages: PromptMessage[]): string =>
    messages.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join("\n") + "\nASSISTANT:",

  claude: (messages: PromptMessage[]): string =>
    messages
      .map((m) => (m.role === "user" ? `Human: ${m.content}` : m.role === "assistant" ? `Assistant: ${m.content}` : ""))
      .join("\n") + "\nAssistant:",

  openai: (messages: PromptMessage[]): PromptMessage[] => {
    const systemPrompt: PromptMessage = { role: "system", content: DEFAULT_SYSTEM_PROMPT };
    return [systemPrompt, ...messages];
  },
};

/**
 * Unified builder per model
 */
export function buildPromptForModel(
  messages: PromptMessage[],
  model: "gemini" | "claude" | "openai"
): string | PromptMessage[] {
  switch (model) {
    case "gemini":
      return PromptTemplates.gemini(messages);
    case "claude":
      return PromptTemplates.claude(messages);
    case "openai":
      return PromptTemplates.openai(messages);
    default:
      throw new Error(`Unsupported model: ${model}`);
  }
}

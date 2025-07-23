import dotenv from "dotenv";
import NodeCache from "node-cache";
import { logError } from "../utils/logger";
import client from "prom-client";
import axios from "axios";
import { buildClaudePrompt } from "../utils/prompt";
dotenv.config();

// Prometheus metrics
export const claudeDurationHistogram = new client.Histogram({
  name: "claude_api_duration_ms",
  help: "Duration of Claude API calls in ms",
  labelNames: ["operation", "status", "model"],
  buckets: [50, 100, 300, 500, 1000, 2000, 5000],
});

// Claude config
const claudeApiUrl = process.env.CLAUDE_API_URL || "https://api.anthropic.com/v1/complete";
const claudeApiKey = process.env.CLAUDE_API_KEY || "";
const temperature = parseFloat(process.env.CLAUDE_TEMPERATURE || "0.7");
const max_tokens = parseInt(process.env.CLAUDE_MAX_TOKENS || "1024");
const timeout = parseInt(process.env.CLAUDE_TIMEOUT_MS || "15000");
export const claudeModel = process.env.CLAUDE_MODEL || "claude-2";
const enableClaudeCache = process.env.CLAUDE_CACHE === "true";

// Cache
const claudeCache = new NodeCache({ stdTTL: 3600 });

// Claude API expected response type
interface ClaudeResponse {
  completion: string;
  usage?: {
    total_tokens?: number;
  };
  completion_id?: string;
}

// Types
export interface ClaudeMessage {
  role: "user" | "assistant";
  content: string;
}

// Timeout wrapper
function timeoutPromise<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Timeout")), ms);
    promise
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

// Retry with timeout and metrics
async function retryClaude<T>(fn: () => Promise<T>, model = claudeModel, retries = 3): Promise<T> {
  const endTimer = claudeDurationHistogram.startTimer({ operation: "claude", model });
  while (retries > 0) {
    try {
      const result = await timeoutPromise(fn(), timeout);
      endTimer({ status: "success" });
      return result;
    } catch (err) {
      retries--;
      if (retries === 0) {
        endTimer({ status: "failure" });
        throw err;
      }
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  endTimer({ status: "failure" });
  throw new Error("Retry failed");
}

// Claude Chat API
export async function chatWithClaude(messages: ClaudeMessage[], model = claudeModel): Promise<string> {
  const prompt = buildClaudePrompt(messages);
  const cacheKey = `${model}-${prompt}`;

  if (enableClaudeCache) {
    const cached = claudeCache.get<string>(cacheKey);
    if (cached) return cached;
  }

  const payload = {
    model,
    prompt,
    temperature,
    max_tokens,
  };

  return retryClaude(async () => {
    const res = await axios.post<ClaudeResponse>(claudeApiUrl, payload, {
      headers: {
        "Content-Type": "application/json",
        "x-api-key": claudeApiKey,
      },
    });

    const completion = res.data.completion || "[No response]";
    const usage = res.data.usage;
    const completion_id = res.data.completion_id;

    console.log("Claude Completion ID:", completion_id);
    if (usage) {
      console.log("Claude Usage – Tokens:", usage.total_tokens);
    }

    if (enableClaudeCache) claudeCache.set(cacheKey, completion);
    return completion;
  }, model);
}

// Claude unified provider interface
export const ClaudeProvider = {
  chat: chatWithClaude,
};

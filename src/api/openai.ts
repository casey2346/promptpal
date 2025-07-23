// src/api/openai.ts
import OpenAI from "openai";
import dotenv from "dotenv";
import NodeCache from "node-cache";
import { logError } from "../utils/logger";
import { PassThrough } from "stream";
import client from "prom-client";
import { Stream } from "openai/streaming";
import { ChatCompletionChunk } from "openai/resources/chat/completions";
import { ChatCompletion } from "openai/resources/chat/completions";


dotenv.config();

// Prometheus metrics
export const openaiDurationHistogram = new client.Histogram({
  name: "openai_api_duration_ms",
  help: "Duration of OpenAI API calls in ms",
  labelNames: ["operation", "status"],
  buckets: [50, 100, 300, 500, 1000, 2000, 5000],
});

// API Key Rotation
const keys = (process.env.OPENAI_KEYS || "").split(",").map((k) => k.trim());
let keyIndex = 0;
function getNextKey() {
  const key = keys[keyIndex];
  keyIndex = (keyIndex + 1) % keys.length;
  return key;
}

// Config
const temperature = parseFloat(process.env.OPENAI_TEMPERATURE || "0.7");
const max_tokens = parseInt(process.env.OPENAI_MAX_TOKENS || "1024");
const timeout = parseInt(process.env.OPENAI_TIMEOUT_MS || "15000");
const MAX_INPUT_LENGTH = parseInt(process.env.EMBEDDING_INPUT_LIMIT || "8192");

// Cache
const embeddingCache = new NodeCache({ stdTTL: 3600 });

// Types
export interface ChatMessage {
  role: "system" | "user" | "assistant";
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

// Retry wrapper with Prometheus + timeout
async function retryOpenAI<T>(fn: () => Promise<T>, operation: string, retries = 3): Promise<T> {
  const endTimer = openaiDurationHistogram.startTimer({ operation });
  while (retries > 0) {
    try {
      const result = await timeoutPromise(fn(), timeout);
      endTimer({ status: "success" });
      return result;
    } catch (err: any) {
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

// Chat API
export async function chatWithOpenAI(
  messages: ChatMessage[],
  model = "gpt-4",
  stream = false
): Promise<string | Stream<ChatCompletionChunk>>
 {
  const apiKey = getNextKey();
  const openai = new OpenAI({ apiKey });

  return retryOpenAI(async () => {
    const response = await openai.chat.completions.create({
      model,
      messages,
      temperature,
      max_tokens,
      stream,
    });

    if (stream && Symbol.asyncIterator in response) {
      return response;
    }

    const nonStreamResponse = response as ChatCompletion;

    console.log("Tokens used:", nonStreamResponse.usage?.total_tokens);

    return nonStreamResponse.choices?.[0]?.message?.content ?? "[No response]";
  }, "chat");
}



// Embedding API
export async function generateEmbedding(
  text: string,
  model = "text-embedding-ada-002"
): Promise<number[]> {
  const cacheKey = `${model}-${text}`;
  const cached = embeddingCache.get<number[]>(cacheKey);
  if (cached) return cached;

  const cleanText = text.replace(/[\r\n\t]+/g, " ").slice(0, MAX_INPUT_LENGTH);
  const apiKey = getNextKey();
  const openai = new OpenAI({ apiKey });

  return retryOpenAI(async () => {
    const res = await openai.embeddings.create({ model, input: cleanText });
    console.log("Embedding tokens used:", res.usage?.total_tokens);
    const embedding = res.data[0].embedding;
    embeddingCache.set(cacheKey, embedding);
    return embedding;
  }, "embedding");
}

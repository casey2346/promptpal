// src/api/gemini.ts
import dotenv from "dotenv";
import axios, { AxiosResponse } from "axios";

 const res: AxiosResponse<any> = await axios.post("https://example.com", {
  prompt: "Your prompt here",
});

import NodeCache from "node-cache";
import client from "prom-client";
import { logError } from "../utils/logger";
import { GeminiMessage } from "../types";
import { buildGeminiPrompt } from "../utils/buildPrompt";
dotenv.config();

// Prometheus Metrics
export const geminiDurationHistogram = new client.Histogram({
  name: "gemini_api_duration_ms",
  help: "Duration of Gemini API calls in ms",
  labelNames: ["operation", "status", "model"],
  buckets: [50, 100, 300, 500, 1000, 2000, 5000],
});

export const geminiTokenCounter = new client.Counter({
  name: "gemini_api_total_tokens",
  help: "Total tokens used by Gemini API",
  labelNames: ["model"],
});

export const geminiFallbackCounter = new client.Counter({
  name: "gemini_api_fallback_total",
  help: "Total fallback attempts used",
  labelNames: ["from_model", "to_model"],
});

export const geminiFailureCounter = new client.Counter({
  name: "gemini_api_failure_total",
  help: "Total failures in Gemini requests",
  labelNames: ["model"],
});

// Config
const geminiApiUrl = process.env.GEMINI_API_URL ||
  "https://generativelanguage.googleapis.com/v1beta/models";
const geminiApiKey = process.env.GEMINI_API_KEY || "";
const fallbackModels = (process.env.GEMINI_FALLBACK_MODELS || "").split(",").map((m) => m.trim());
const geminiModel = process.env.GEMINI_MODEL || "gemini-pro";
const temperature = parseFloat(process.env.GEMINI_TEMPERATURE || "0.7");
const maxTokens = parseInt(process.env.GEMINI_MAX_TOKENS || "1024");
const timeout = parseInt(process.env.GEMINI_TIMEOUT_MS || "15000");
const enableGeminiCache = process.env.GEMINI_CACHE === "true";

// Cache
const geminiCache = new NodeCache({ stdTTL: 3600 });

// Timeout helper
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

// Retry logic with metrics
async function retryGemini<T>(fn: () => Promise<T>, model: string, retries = 3): Promise<T> {
  const end = geminiDurationHistogram.startTimer({ operation: "gemini", model });
  while (retries > 0) {
    try {
      const result = await timeoutPromise(fn(), timeout);
      end({ status: "success" });
      return result;
    } catch (err) {
      retries--;
      if (retries === 0) {
        geminiFailureCounter.inc({ model });
        end({ status: "failure" });
        throw err;
      }
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw new Error("Retry failed");
}

// Call actual Gemini API
async function callGeminiAPI(prompt: string, model: string): Promise<string> {
  const payload = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { temperature, maxOutputTokens: maxTokens },
  };

  const url = `${geminiApiUrl}/${model}:generateContent?key=${geminiApiKey}`;
  const res: AxiosResponse<any> = await axios.post(url, payload);

  const text = res.data.candidates?.[0]?.content?.parts?.[0]?.text || "[No response]";
  const usage = res.data.usageMetadata;
  const requestId = res.headers["x-request-id"];

  if (usage?.totalTokens) {
    geminiTokenCounter.inc({ model }, usage.totalTokens);
    console.log(`Gemini Token Usage [${model}]:`, usage.totalTokens);
  }

  if (requestId) {
    console.log(`Gemini Request ID [${model}]:`, requestId);
  }

  return text;
}

// Gemini public API
export async function chatWithGemini(messages: GeminiMessage[], model = geminiModel): Promise<string> {
  const prompt = buildGeminiPrompt(messages);
  const cacheKey = `${model}-${prompt}`;

  if (enableGeminiCache) {
    const cached = geminiCache.get<string>(cacheKey);
    if (cached) return cached;
  }

  const modelsToTry = [model, ...fallbackModels.filter((m) => m && m !== model)];
  for (let i = 0; i < modelsToTry.length; i++) {
    const currentModel = modelsToTry[i];
    try {
      const response = await retryGemini(() => callGeminiAPI(prompt, currentModel), currentModel);
      if (enableGeminiCache) geminiCache.set(cacheKey, response);

      if (i > 0) {
        geminiFallbackCounter.inc({ from_model: model, to_model: currentModel });
        console.warn(`Fallback to model ${currentModel} used.`);
      }

      return response;
    } catch (e) {
      logError(`Gemini model ${currentModel} failed`, e);
    }
  }

  throw new Error("All Gemini models failed");
}

// Unified provider export
export const GeminiProvider = {
  chat: chatWithGemini,
};

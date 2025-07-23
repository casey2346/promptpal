import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

/**
 * ✅ Supported models for dropdowns / dynamic routing
 */
export const SUPPORTED_MODELS = ["gemini", "claude", "openai"] as const;
export type SupportedModel = typeof SUPPORTED_MODELS[number];

/**
 * ✅ Zod schema for env var validation
 */
const envSchema = z.object({
  DEFAULT_MODEL: z.string().default("gemini-pro"),
  DEFAULT_TEMPERATURE: z.string().default("0.7"),
  DEFAULT_MAX_TOKENS: z.string().default("1024"),
  ENABLE_CACHING: z.string().optional(),
  ENABLE_LOGGING: z.string().optional(),
  ENABLE_TELEMETRY: z.string().optional(),
  FALLBACK_MODELS: z.string().optional(),
  MAX_RETRIES: z.string().default("3"),
  TIMEOUT_MS: z.string().default("15000"),
  NODE_ENV: z.string().optional(),

  // ✅ Optional weights from .env
  SCORE_WEIGHT_TOKEN_EFFICIENCY: z.string().optional(),
  SCORE_WEIGHT_RESPONSE_LENGTH: z.string().optional(),
  SCORE_WEIGHT_COMPLETENESS: z.string().optional(),
  SCORE_WEIGHT_LATENCY: z.string().optional(),
  SCORE_WEIGHT_FALLBACK: z.string().optional(),
});

const parsedEnv = envSchema.parse(process.env);

/**
 * ✅ Main configuration interface
 */
export interface AISettings {
  defaultModel: string;
  temperature: number;
  maxTokens: number;
  enableCaching: boolean;
  fallbackModels: string[];
  enableLogging: boolean;
  enableTelemetry: boolean;
  maxRetries: number;
  timeoutMs: number;

  // ✅ Scoring weights
  scoreWeightTokenEfficiency: number;
  scoreWeightResponseLength: number;
  scoreWeightCompleteness: number;
  scoreWeightLatency: number;
  scoreWeightFallback: number;
}

/**
 * ✅ Default system-wide AI settings
 */
export const DefaultAISettings: Readonly<AISettings> = {
  defaultModel: parsedEnv.DEFAULT_MODEL,
  temperature: parseFloat(parsedEnv.DEFAULT_TEMPERATURE),
  maxTokens: parseInt(parsedEnv.DEFAULT_MAX_TOKENS),
  enableCaching: parsedEnv.ENABLE_CACHING === "true",
  fallbackModels: (parsedEnv.FALLBACK_MODELS || "")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean),
  enableLogging: parsedEnv.ENABLE_LOGGING !== "false",
  enableTelemetry: parsedEnv.ENABLE_TELEMETRY !== "false",
  maxRetries: parseInt(parsedEnv.MAX_RETRIES),
  timeoutMs: parseInt(parsedEnv.TIMEOUT_MS),

  // ✅ Fallback to hardcoded weights if not in env
  scoreWeightTokenEfficiency: parseFloat(parsedEnv.SCORE_WEIGHT_TOKEN_EFFICIENCY || "0.25"),
  scoreWeightResponseLength: parseFloat(parsedEnv.SCORE_WEIGHT_RESPONSE_LENGTH || "0.25"),
  scoreWeightCompleteness: parseFloat(parsedEnv.SCORE_WEIGHT_COMPLETENESS || "0.2"),
  scoreWeightLatency: parseFloat(parsedEnv.SCORE_WEIGHT_LATENCY || "0.2"),
  scoreWeightFallback: parseFloat(parsedEnv.SCORE_WEIGHT_FALLBACK || "0.1"),
};

/**
 * ✅ Resolve config with runtime overrides (e.g. per request)
 */
export function resolveAISettings(overrides: Partial<AISettings> = {}): AISettings {
  return {
    ...DefaultAISettings,
    ...overrides,
  };
}

/**
 * ✅ Filtered output for frontend (no sensitive flags)
 */
export function getSettingsJSON(): Record<string, any> {
  return {
    supportedModels: SUPPORTED_MODELS,
    defaults: {
      defaultModel: DefaultAISettings.defaultModel,
      temperature: DefaultAISettings.temperature,
      maxTokens: DefaultAISettings.maxTokens,
      timeoutMs: DefaultAISettings.timeoutMs,
    },
  };
}

// ✅ Console output for debugging misconfiguration (only in non-production)
if (parsedEnv.NODE_ENV !== "production") {
  console.log("[Settings Loaded]", getSettingsJSON());
}

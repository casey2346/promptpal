import client from "prom-client";
import { DefaultAISettings } from "../storage/settings";

/**
 * Scoring module for evaluating AI model responses
 * Supports token cost, latency, completeness, and fallback penalties
 * Can be extended for reward modeling, ranking, fine-tuning
 */

export interface ScoreInput {
  prompt: string;
  response: string;
  totalTokens: number;
  durationMs: number;
  model: string;
  fallbackUsed?: boolean;
  gptScoreBaseline?: number;
}

export interface ScoreOutput {
  score: number; // [0-1] normalized score
  breakdown: {
    tokenEfficiency: number;
    responseLength: number;
    latencyPenalty: number;
    fallbackPenalty: number;
    completenessScore: number;
    gptScoreBaseline?: number;
  };
}

const MAX_TOKENS = 4096;
const MAX_LATENCY_MS = 5000;
const IDEAL_RESPONSE_LENGTH = 400;

// Sliding window
const recentScores: number[] = [];
const MAX_HISTORY = 100;

// Prometheus metrics
export const scoreGauge = new client.Gauge({
  name: "ai_score_overall",
  help: "Overall AI response score",
  labelNames: ["model"],
});

export const scoreBreakdownGauges = {
  tokenEfficiency: new client.Gauge({
    name: "ai_score_token_efficiency",
    help: "Token efficiency",
    labelNames: ["model"],
  }),
  responseLength: new client.Gauge({
    name: "ai_score_response_length",
    help: "Response length score",
    labelNames: ["model"],
  }),
  latencyPenalty: new client.Gauge({
    name: "ai_score_latency_penalty",
    help: "Latency penalty",
    labelNames: ["model"],
  }),
  fallbackPenalty: new client.Gauge({
    name: "ai_score_fallback_penalty",
    help: "Fallback penalty",
    labelNames: ["model"],
  }),
  completenessScore: new client.Gauge({
    name: "ai_score_completeness",
    help: "Completeness score",
    labelNames: ["model"],
  }),
};

/**
 * Main scoring function
 */
export function evaluateScore(input: ScoreInput): ScoreOutput {
  const {
    response,
    totalTokens,
    durationMs,
    fallbackUsed = false,
    model,
    gptScoreBaseline,
  } = input;

  const {
    scoreWeightTokenEfficiency,
    scoreWeightResponseLength,
    scoreWeightCompleteness,
    scoreWeightLatency,
    scoreWeightFallback,
  } = DefaultAISettings;

  const tokenEfficiency = 1 - Math.min(totalTokens / MAX_TOKENS, 1);
  const lenRatio = response.length / IDEAL_RESPONSE_LENGTH;
  const responseLength = lenRatio > 1 ? 1 - (lenRatio - 1) : lenRatio;
  const latencyPenalty = Math.min(durationMs / MAX_LATENCY_MS, 1);
  const fallbackPenalty = fallbackUsed ? 0.2 : 0;
  const completenessScore = response.trim().length > 50 ? 1 : 0.5;

  const score =
    scoreWeightTokenEfficiency * tokenEfficiency +
    scoreWeightResponseLength * responseLength +
    scoreWeightCompleteness * completenessScore +
    scoreWeightLatency * (1 - latencyPenalty) +
    scoreWeightFallback * (1 - fallbackPenalty);

  // Push to Prometheus
  scoreGauge.set({ model }, score);
  scoreBreakdownGauges.tokenEfficiency.set({ model }, tokenEfficiency);
  scoreBreakdownGauges.responseLength.set({ model }, responseLength);
  scoreBreakdownGauges.latencyPenalty.set({ model }, latencyPenalty);
  scoreBreakdownGauges.fallbackPenalty.set({ model }, fallbackPenalty);
  scoreBreakdownGauges.completenessScore.set({ model }, completenessScore);

  // Update sliding window
  recentScores.push(score);
  if (recentScores.length > MAX_HISTORY) recentScores.shift();

  return {
    score: Math.max(0, Math.min(score, 1)),
    breakdown: {
      tokenEfficiency,
      responseLength,
      latencyPenalty,
      fallbackPenalty,
      completenessScore,
      gptScoreBaseline,
    },
  };
}

/**
 * Export full score JSON for frontend/API
 */
export function evaluateScoreJSON(input: ScoreInput): Record<string, any> {
  const result = evaluateScore(input);
  return {
    model: input.model,
    tokens: input.totalTokens,
    latencyMs: input.durationMs,
    fallbackUsed: input.fallbackUsed || false,
    gptScoreBaseline: input.gptScoreBaseline,
    trendWindowAvg: getSlidingScoreAverage(),
    ...result,
  };
}

/**
 * Get sliding average score
 */
export function getSlidingScoreAverage(): number {
  if (recentScores.length === 0) return 0;
  const sum = recentScores.reduce((a, b) => a + b, 0);
  return parseFloat((sum / recentScores.length).toFixed(4));
}

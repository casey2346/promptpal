import * as client from 'prom-client';
import { DefaultAISettings } from "../storage/settings";

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
  score: number;
  breakdown: {
    tokenEfficiency: number;
    responseLength: number;
    latencyPenalty: number;
    fallbackPenalty: number;
    completenessScore: number;
    gptScoreBaseline?: number;
    gptDeltaScore?: number;
  };
}

const MAX_TOKENS = 4096;
const MAX_LATENCY_MS = 5000;
const IDEAL_RESPONSE_LENGTH = 400;
const recentScores: number[] = [];
const MAX_HISTORY = 100;

export const scoreGauge = new client.Gauge({
  name: "ai_score_overall",
  help: "Overall AI response score",
  labelNames: ["model"]
});

export const scoreBreakdownGauges = {
  tokenEfficiency: new client.Gauge({ name: "ai_score_token_efficiency", help: "Token efficiency", labelNames: ["model"] }),
  responseLength: new client.Gauge({ name: "ai_score_response_length", help: "Response length score", labelNames: ["model"] }),
  latencyPenalty: new client.Gauge({ name: "ai_score_latency_penalty", help: "Latency penalty", labelNames: ["model"] }),
  fallbackPenalty: new client.Gauge({ name: "ai_score_fallback_penalty", help: "Fallback penalty", labelNames: ["model"] }),
  completenessScore: new client.Gauge({ name: "ai_score_completeness", help: "Completeness score", labelNames: ["model"] }),
};

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
    scoreWeightTokenEfficiency = 0.25,
    scoreWeightResponseLength = 0.25,
    scoreWeightCompleteness = 0.2,
    scoreWeightLatency = 0.2,
    scoreWeightFallback = 0.1,
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

  const normalizedScore = Math.max(0, Math.min(score, 1));
  const gptDeltaScore = gptScoreBaseline !== undefined ? normalizedScore - gptScoreBaseline : undefined;

  scoreGauge.set({ model }, normalizedScore);
  scoreBreakdownGauges.tokenEfficiency.set({ model }, tokenEfficiency);
  scoreBreakdownGauges.responseLength.set({ model }, responseLength);
  scoreBreakdownGauges.latencyPenalty.set({ model }, latencyPenalty);
  scoreBreakdownGauges.fallbackPenalty.set({ model }, fallbackPenalty);
  scoreBreakdownGauges.completenessScore.set({ model }, completenessScore);

  recentScores.push(normalizedScore);
  if (recentScores.length > MAX_HISTORY) recentScores.shift();

  return {
    score: normalizedScore,
    breakdown: {
      tokenEfficiency,
      responseLength,
      latencyPenalty,
      fallbackPenalty,
      completenessScore,
      gptScoreBaseline,
      gptDeltaScore,
    },
  };
}

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

export function getSlidingScoreAverage(): number {
  if (recentScores.length === 0) return 0;
  const sum = recentScores.reduce((a, b) => a + b, 0);
  return parseFloat((sum / recentScores.length).toFixed(4));
}

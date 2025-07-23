// src/utils/summary.ts

export function summarizeDeltas(results: Record<string, any>[]) {
  const deltas = results
    .map(r => r.breakdown?.gptDeltaScore)
    .filter((d): d is number => typeof d === "number");

  if (deltas.length === 0) {
    return {
      meanDelta: 0,
      maxDelta: 0,
      minDelta: 0,
    };
  }

  const meanDelta = parseFloat((deltas.reduce((a, b) => a + b, 0) / deltas.length).toFixed(4));
  const maxDelta = Math.max(...deltas);
  const minDelta = Math.min(...deltas);

  return { meanDelta, maxDelta, minDelta };
}

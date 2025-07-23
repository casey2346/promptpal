// src/utils/asciiChart.ts

export function printHistogram(values: number[], bins = 10) {
  if (values.length === 0) {
    console.log("No data to plot.");
    return;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1; // prevent division by zero
  const binSize = range / bins;
  const counts = new Array(bins).fill(0);

  for (const v of values) {
    const index = Math.min(Math.floor((v - min) / binSize), bins - 1);
    counts[index]++;
  }

  const maxCount = Math.max(...counts);
  const scale = 40 / maxCount;

  console.log(`\nASCII Histogram (Latency in ms):`);
  for (let i = 0; i < bins; i++) {
    const lower = (min + i * binSize).toFixed(0).padStart(5);
    const upper = (min + (i + 1) * binSize).toFixed(0).padStart(5);
    const bar = "▇".repeat(Math.round(counts[i] * scale));
    console.log(`[${lower} - ${upper}) | ${bar} (${counts[i]})`);
  }
}

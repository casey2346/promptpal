// src/utils/exportMarkdown.ts

/**
 * Export scoring results as a Markdown summary document.
 * Suitable for evaluation reports and GitHub readmes.
 */

export function generateMarkdown(results: Record<string, any>[]): string {
  const lines: string[] = [];

  lines.push("# Evaluation Report\n");

  results.forEach((r, i) => {
    lines.push(`## Session ${i + 1}`);
    lines.push(`- **Model**: ${r.model}`);
    lines.push(`- **Score**: ${r.score.toFixed(3)}`);
    lines.push(`- **Prompt Length (tokens)**: ${r.totalTokens}`);
    lines.push(`- **Latency**: ${r.durationMs} ms`);
    lines.push(`- **Fallback Used**: ${r.fallbackUsed ? "Yes" : "No"}`);
    if (r.breakdown?.gptScoreBaseline !== undefined) {
      lines.push(`- **GPT Baseline**: ${r.breakdown.gptScoreBaseline}`);
      lines.push(`- **Delta**: ${r.breakdown.gptDeltaScore}`);
    }
    lines.push(""); // blank line
  });

  return lines.join("\n");
}

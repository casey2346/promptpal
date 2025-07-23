// src/utils/exportHTML.ts

/**
 * Export evaluation results to a simple HTML report.
 * Ideal for judges, reviewers, or sharing online.
 */

export function generateHTMLReport(results: Record<string, any>[]): string {
  const html: string[] = [];

  html.push(`<html><head>
  <meta charset="UTF-8">
  <title>Evaluation Report</title>
  <style>
    body { font-family: sans-serif; margin: 2rem; }
    h1 { color: #2c3e50; }
    table { border-collapse: collapse; width: 100%; margin-top: 1rem; }
    th, td { border: 1px solid #ddd; padding: 0.5rem; text-align: left; }
    th { background-color: #f4f4f4; }
  </style>
  </head><body>`);

  html.push(`<h1>AI Evaluation Report</h1>`);

  results.forEach((r, i) => {
    html.push(`<h2>Session ${i + 1}</h2>`);
    html.push(`<table><tbody>`);
    html.push(`<tr><th>Model</th><td>${r.model}</td></tr>`);
    html.push(`<tr><th>Score</th><td>${r.score.toFixed(3)}</td></tr>`);
    html.push(`<tr><th>Tokens</th><td>${r.totalTokens}</td></tr>`);
    html.push(`<tr><th>Latency (ms)</th><td>${r.durationMs}</td></tr>`);
    html.push(`<tr><th>Fallback</th><td>${r.fallbackUsed ? "Yes" : "No"}</td></tr>`);
    if (r.breakdown?.gptScoreBaseline !== undefined) {
      html.push(`<tr><th>GPT Baseline</th><td>${r.breakdown.gptScoreBaseline}</td></tr>`);
      html.push(`<tr><th>Delta</th><td>${r.breakdown.gptDeltaScore}</td></tr>`);
    }
    html.push(`</tbody></table>`);
  });

  html.push(`</body></html>`);

  return html.join("\n");
}

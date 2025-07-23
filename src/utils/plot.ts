// src/utils/plot.ts

import { ChartJSNodeCanvas } from "chartjs-node-canvas";
import fs from "fs";

const width = 800;
const height = 600;

const chartJSNodeCanvas = new ChartJSNodeCanvas({ width, height });

export async function generateScorePlot(data: Record<string, any>[], filename: string) {
  const labels = data.map((d, i) => `Session ${i + 1}`);
  const scores = data.map((d) => d.score);
  const baselines = data.map((d) => d.breakdown.gptScoreBaseline ?? null);

  const configuration = {
    type: "bar" as const,
    data: {
      labels,
      datasets: [
        {
          label: "Model Score",
          data: scores,
          backgroundColor: "rgba(54, 162, 235, 0.7)",
        },
        {
          label: "GPT Baseline",
          data: baselines,
          backgroundColor: "rgba(255, 99, 132, 0.5)",
        },
      ],
    },
    options: {
      responsive: false,
      plugins: {
        title: {
          display: true,
          text: "Model Score vs GPT Baseline",
        },
        legend: {
          position: "bottom" as const,
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          max: 1,
        },
      },
    },
  };

  const buffer = await chartJSNodeCanvas.renderToBuffer(configuration);
  fs.writeFileSync(filename, buffer);
}

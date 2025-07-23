// src/charts/scoringChart.ts

/**
 * 📊 Scoring Trend Chart Generator
 * Generates ECharts-compatible JSON configuration for frontend visualization
 * of AI model evaluation scores and breakdowns over time or batch.
 * Supports: multi-model comparison, timestamp trend, light/dark theme,
 * zoomable view, locale-based labels, custom tooltip, area + line mix,
 * animated series, and optional export.
 */

import type { EChartsOption, SeriesOption } from "echarts";

export type ScoreBreakdown = {
  id?: string;
  score: number;
  accuracy: number;
  relevance: number;
  fluency: number;
  safety: number;
  efficiency: number;
  model: string;
  timestamp?: string;
};

export type ChartTheme = "light" | "dark";
export type ChartLocale = "en" | "zh";

const LABELS: Record<ChartLocale, Record<string, string>> = {
  en: {
    title: "AI Model Evaluation Trend",
    score: "Score",
    accuracy: "Accuracy",
    relevance: "Relevance",
    fluency: "Fluency",
    safety: "Safety",
    efficiency: "Efficiency"
  },
  zh: {
    title: "AI 模型评分趋势",
    score: "总分",
    accuracy: "准确性",
    relevance: "相关性",
    fluency: "流畅性",
    safety: "安全性",
    efficiency: "效率"
  }
};

/**
 * Generate ECharts option config from score breakdown array
 */
export function generateScoreTrendChart(
  data: ScoreBreakdown[],
  theme: ChartTheme = "light",
  locale: ChartLocale = "en"
): EChartsOption {
  const useTimestamp = data.every(d => !!d.timestamp);
  const xLabels = useTimestamp
    ? data.map(d => new Date(d.timestamp!).toLocaleString())
    : data.map((d, i) => d.id || `#${i + 1}`);

  const labels = LABELS[locale];

  const groupByModel = new Map<string, ScoreBreakdown[]>();
  for (const d of data) {
    if (!groupByModel.has(d.model)) groupByModel.set(d.model, []);
    groupByModel.get(d.model)!.push(d);
  }

  const series: SeriesOption[] = [];

  for (const [model, entries] of groupByModel) {
    const makeLine = (
      name: keyof ScoreBreakdown,
      display: string,
      area = false
    ): SeriesOption => ({
      name: `${display} (${model})`,
      type: "line",
      data: entries.map(d => d[name] ?? 0),
      smooth: true,
      areaStyle: area ? {} : undefined,
      lineStyle: { width: 2 },
      emphasis: { focus: "series" },
      animationDuration: 1000
    });

    series.push(makeLine("score", labels.score, true));
    series.push(makeLine("accuracy", labels.accuracy));
    series.push(makeLine("relevance", labels.relevance));
    series.push(makeLine("fluency", labels.fluency));
    series.push(makeLine("safety", labels.safety));
    series.push(makeLine("efficiency", labels.efficiency));
  }

  return {
    backgroundColor: theme === "dark" ? "#1f1f1f" : "#fff",
    textStyle: {
      color: theme === "dark" ? "#eee" : "#000"
    },
    title: {
      text: labels.title,
      left: "center",
      textStyle: {
        color: theme === "dark" ? "#fff" : "#000"
      }
    },
    tooltip: {
      trigger: "axis",
      axisPointer: {
        type: "cross",
        label: {
          backgroundColor: "#6a7985"
        }
      }
    },
    legend: {
      top: "bottom",
      type: "scroll"
    },
    dataZoom: [
      { type: "inside" },
      { type: "slider" }
    ],
    grid: {
      left: "3%",
      right: "4%",
      bottom: "12%",
      containLabel: true
    },
    xAxis: {
      type: "category",
      boundaryGap: false,
      data: xLabels
    },
    yAxis: {
      type: "value",
      max: 1,
      min: 0
    },
    series
  };
}

/**
 * Optional: Export ECharts option config for saving/sharing
 */
export function exportChartOption(option: EChartsOption): string {
  return JSON.stringify(option, null, 2);
}

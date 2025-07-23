// src/ui/editor.ts

import readline from "readline";
import fs from "fs";
import path from "path";
import { evaluateScoreJSON } from "../scoring/evaluate";
import { exportScoresCSV } from "../utils/exportCSV";
import { generateScorePlot } from "../utils/plot";
import { summarizeDeltas } from "../utils/summary";
import { loadTemplateSessions } from "../utils/loadTemplate";
import { t, setLocale } from "../utils/i18n";

interface EditorSession {
  prompt: string;
  response: string;
  model: string;
  totalTokens: number;
  durationMs: number;
  fallbackUsed?: boolean;
  gptScoreBaseline?: number;
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function askQuestion(query: string): Promise<string> {
  return new Promise((resolve) => rl.question(query, resolve));
}

async function askForSession(): Promise<EditorSession> {
  const prompt = await askQuestion(`\n${t("editor.enter_prompt")}`);
  const response = await askQuestion(t("editor.enter_response"));
  const model = await askQuestion(t("editor.enter_model"));
  const totalTokens = parseInt(await askQuestion(t("editor.enter_tokens")));
  const durationMs = parseInt(await askQuestion(t("editor.enter_latency")));
  const fallback = (await askQuestion(t("editor.enter_fallback"))).toLowerCase() === "y";
  const baselineStr = await askQuestion(t("editor.enter_baseline"));
  const gptScoreBaseline = baselineStr ? parseFloat(baselineStr) : undefined;

  return {
    prompt,
    response,
    model,
    totalTokens,
    durationMs,
    fallbackUsed: fallback,
    gptScoreBaseline,
  };
}

export async function runEditorSession() {
  const lang = await askQuestion(t("editor.select_language"));
  setLocale(lang || "en");
  console.log(t("editor.welcome"));

  const results: Record<string, any>[] = [];

  const useTemplate = (await askQuestion(t("editor.load_template"))).toLowerCase() === "y";
  if (useTemplate) {
    const file = await askQuestion(t("editor.template_path"));
    const sessions = loadTemplateSessions(file || "sessions.json");
    for (const session of sessions) {
      const result = evaluateScoreJSON(session);
      results.push(result);
      console.log(`${t("editor.evaluated")}: ${session.model}`);
    }
  } else {
    while (true) {
      const session = await askForSession();
      const result = evaluateScoreJSON(session);

      console.log(`\n${t("editor.evaluation_complete")}`);
      console.table(result.breakdown);
      console.log(`\n${t("editor.final_score")}: ${result.score}`);

      results.push(result);
      const cont = (await askQuestion(t("editor.add_another"))).toLowerCase();
      if (cont !== "y") break;
    }
  }

  const save = (await askQuestion(t("editor.export_csv"))).toLowerCase() === "y";
  if (save) {
    const filename = await askQuestion(t("editor.csv_filename"));
    await exportScoresCSV(results, filename || "score.csv");
    console.log(t("editor.csv_exported"));
  }

  const markdown = (await askQuestion(t("editor.export_md"))).toLowerCase() === "y";
  if (markdown) {
    const filename = await askQuestion(t("editor.md_filename"));
    const content = results
      .map((r, i) => `### Session ${i + 1}\n\n- **Model**: ${r.model}\n- **Score**: ${r.score}\n- **GPT Baseline**: ${r.breakdown.gptScoreBaseline}\n- **Delta**: ${r.breakdown.gptDeltaScore}`)
      .join("\n\n");
    fs.writeFileSync(filename || "score.md", content);
    console.log(t("editor.md_exported"));
  }

  const chart = (await askQuestion(t("editor.export_plot"))).toLowerCase() === "y";
  if (chart) {
    await generateScorePlot(results, "score_plot.png");
    console.log(t("editor.plot_saved"));
  }

  const templateSave = (await askQuestion(t("editor.save_template"))).toLowerCase() === "y";
  if (templateSave) {
    const filename = await askQuestion(t("editor.template_filename"));
    const rawSessions = results.map(({ breakdown, trendWindowAvg, ...r }) => r);
    fs.writeFileSync(filename || "sessions.json", JSON.stringify(rawSessions, null, 2));
    console.log(t("editor.template_saved"));
  }

  const delta = summarizeDeltas(results);
  console.log(`\n${t("editor.delta_summary")}`);
  console.log(`→ ${t("editor.mean_delta")}: ${delta.meanDelta}`);
  console.log(`→ ${t("editor.max_delta")}: ${delta.maxDelta}`);
  console.log(`→ ${t("editor.min_delta")}: ${delta.minDelta}`);

  rl.close();
}

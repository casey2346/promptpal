// src/ui/testlab.ts

/**
 * 🧪 TestLab UI module (extended with REST API + Web UI integration)
 * Supports CLI args (--md, --chart), REST evaluation API, HTML/MD/CSV/PNG export,
 * and ready for Web UI (e.g., Next.js dashboard.tsx).
 */

import fs from "fs";
import readline from "readline";
import { z } from "zod";
import { evaluateScoreJSON } from "../scoring/evaluate";
import { exportScoresCSV } from "../utils/exportCSV";
import { generateScorePlot } from "../utils/plot";
import { summarizeDeltas } from "../utils/summary";
import { loadTemplateSessions } from "../utils/loadTemplate";
import { setLocale, t } from "../utils/i18n";
import { loadPlugin } from "../utils/plugin";
import { printHistogram } from "../utils/asciiChart";
import { generateMarkdown } from "../utils/exportMarkdown";
import { generateHTMLReport } from "../utils/exportHTML";
import express from "express";

const SessionInputSchema = z.object({
  prompt: z.string(),
  response: z.string(),
  model: z.string(),
  totalTokens: z.number().nonnegative(),
  durationMs: z.number().nonnegative(),
  fallbackUsed: z.boolean().optional(),
  gptScoreBaseline: z.number().min(0).max(1).optional(),
});

type SessionInput = z.infer<typeof SessionInputSchema>;

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(query: string): Promise<string> {
  return new Promise((resolve) => rl.question(query, resolve));
}

export async function runTestLab(args: string[] = []) {
  const lang = await ask("🌍 Language? (en/zh): ");
  setLocale(lang || "en");
  console.log(t("testlab.welcome"));

  const results: Record<string, any>[] = [];

  let customEvaluator = evaluateScoreJSON;
  const pluginArg = args.find((arg) => arg.startsWith("--plugin="));
  if (pluginArg) {
    const pluginPath = pluginArg.split("=")[1];
    customEvaluator = loadPlugin(pluginPath);
    console.log(`🔌 Plugin loaded from ${pluginPath}`);
  }

  const templateArg = args.find((arg) => arg.startsWith("--template="));
  if (templateArg) {
    const templatePath = templateArg.split("=")[1];
    const sessions = loadTemplateSessions(templatePath);
    for (const session of sessions) {
      const parsed = SessionInputSchema.safeParse(session);
      if (!parsed.success) continue;
      const result = customEvaluator(parsed.data);
      results.push(result);
    }
  } else {
    while (true) {
      const prompt = await ask(t("testlab.prompt"));
      const response = await ask(t("testlab.response"));
      const model = await ask(t("testlab.model"));
      const totalTokens = parseInt(await ask(t("testlab.tokens")));
      const durationMs = parseInt(await ask(t("testlab.latency")));
      const fallback = (await ask(t("testlab.fallback"))).toLowerCase() === "y";
      const baselineStr = await ask(t("testlab.baseline"));
      const gptScoreBaseline = baselineStr ? parseFloat(baselineStr) : undefined;

      const session: SessionInput = {
        prompt, response, model, totalTokens, durationMs, fallbackUsed: fallback, gptScoreBaseline
      };

      const parsed = SessionInputSchema.safeParse(session);
      if (!parsed.success) {
        console.warn("❌ Invalid session");
        continue;
      }

      const result = customEvaluator(parsed.data);
      results.push(result);
      console.table(result.breakdown);
      console.log(`🎯 ${t("testlab.score")}: ${result.score}`);

      const cont = (await ask(t("testlab.another"))).toLowerCase();
      if (cont !== "y") break;
    }
  }

  if (args.includes("--csv")) {
    await exportScoresCSV(results, "results.csv");
    console.log(t("testlab.csv_saved"));
  }

  if (args.includes("--chart")) {
    await generateScorePlot(results, "results.png");
    console.log(t("testlab.plot_saved"));
  }

  if (args.includes("--md")) {
    const md = generateMarkdown(results);
    fs.writeFileSync("results.md", md);
    console.log("✅ Markdown exported");
  }

  if (args.includes("--html")) {
    const html = generateHTMLReport(results);
    fs.writeFileSync("results.html", html);
    console.log("✅ HTML report generated");
  }

  const delta = summarizeDeltas(results);
  console.log(`\n📊 ${t("testlab.delta_summary")}`);
  console.log(`→ ${t("testlab.mean_delta")}: ${delta.meanDelta}`);
  console.log(`→ ${t("testlab.max_delta")}: ${delta.maxDelta}`);
  console.log(`→ ${t("testlab.min_delta")}: ${delta.minDelta}`);

  printHistogram(results.map(r => r.durationMs || 0));
  rl.close();
}

// REST API Server (Optional)
export function startAPIServer(port = 3001) {
  const app = express();
  app.use(express.json());

  app.post("/api/evaluate", (req, res) => {
    const parsed = SessionInputSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid input" });
    const result = evaluateScoreJSON(parsed.data);
    return res.json(result);
  });

  app.listen(port, () => {
    console.log(`🚀 TestLab API running at http://localhost:${port}/api/evaluate`);
  });
}

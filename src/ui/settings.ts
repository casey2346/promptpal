/**
 * ⚙️ System-wide AI Evaluation Settings
 * Supports: .env + config.(json|yaml|remote), CLI config path, export validation,
 * hot-reload with chokidar (with debounce), multi-env .env.{env},
 * frontend export, logging with debug, config versioning, i18n, and testability.
 */

import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import yaml from "js-yaml";
import chokidar from "chokidar";
import debug from "debug";
import { z } from "zod";
import fetch from "node-fetch"; 

const ENV = process.env.NODE_ENV || "development";
const envFile = `.env.${ENV}`;
dotenv.config({ path: envFile });

const log = debug("settings");

export const allowedExportFormats = ["csv", "md", "html", "json"] as const;
export const ExportFormatEnum = z.enum(allowedExportFormats);

export type ExportFormat = typeof ExportFormatEnum._type;

export const AISettingsSchema = z.object({
  version: z.string().default("1.0.0"),
  scoreWeightAccuracy: z.number(),
  scoreWeightRelevance: z.number(),
  scoreWeightFluency: z.number(),
  scoreWeightSafety: z.number(),
  scoreWeightTokenEfficiency: z.number(),
  baselineModel: z.string().optional(),
  maxAllowedLatencyMs: z.number().optional(),
  locale: z.union([z.literal("en"), z.literal("zh")]),
  exportFormat: ExportFormatEnum,
});

export type AISettings = z.infer<typeof AISettingsSchema>;

export let currentSettings: AISettings = {
  version: "1.0.0",
  scoreWeightAccuracy: 0.35,
  scoreWeightRelevance: 0.25,
  scoreWeightFluency: 0.2,
  scoreWeightSafety: 0.1,
  scoreWeightTokenEfficiency: 0.1,
  baselineModel: process.env.BASELINE_MODEL || "gpt-4",
  maxAllowedLatencyMs: parseInt(process.env.MAX_LATENCY_MS || "3000"),
  locale: (process.env.DEFAULT_LOCALE as "en" | "zh") || "en",
  exportFormat: (process.env.DEFAULT_EXPORT as ExportFormat) || "csv",
};

export function applySettings(overrides: Partial<AISettings> = {}): AISettings {
  const merged = { ...currentSettings, ...overrides };
  const parsed = AISettingsSchema.safeParse(merged);
  if (!parsed.success) {
    throw new Error("\u274c Invalid configuration: " + JSON.stringify(parsed.error.format()));
  }
  if (parsed.data.version && parsed.data.version < "1.0.0") {
    throw new Error(`\u26a0\ufe0f Unsupported config version: ${parsed.data.version}`);
  }
  currentSettings = parsed.data;
  log("\u2705 Settings applied:", currentSettings);
  return currentSettings;
}

export function loadSettingsFromFile(filePath = "config.json"): Partial<AISettings> {
  const resolved = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(resolved)) return {};
  try {
    const raw = fs.readFileSync(resolved, "utf-8");
    const parsed = filePath.endsWith(".yaml") || filePath.endsWith(".yml")
      ? yaml.load(raw)
      : JSON.parse(raw);
    return parsed as Partial<AISettings>;
  } catch (err) {
    console.warn(`\u26a0\ufe0f Failed to load config from ${filePath}:`, err);
    return {};
  }
}

export async function loadSettingsFromURL(url: string): Promise<Partial<AISettings>> {
  try {
    const res = await fetch(url);
    const text = await res.text();
    return url.endsWith(".yaml") || url.endsWith(".yml")
      ? (yaml.load(text) as Partial<AISettings>)
      : JSON.parse(text);
  } catch (e) {
    console.warn("\u26a0\ufe0f Failed to fetch config from URL:", url, e);
    return {};
  }
}

export function printEffectiveSettings(settings: AISettings) {
  console.log("\ud83d\udd27 Active Evaluation Settings:");
  console.table(settings);
}

export function exportToFrontend(settings: AISettings, outPath = "./public/config.json") {
  fs.writeFileSync(outPath, JSON.stringify(settings, null, 2));
  log("\ud83d\udcc4 Settings exported to frontend at", outPath);
}

export function reloadSettings(configPath = "config.json") {
  const newSettings = loadSettingsFromFile(configPath);
  applySettings(newSettings);
  log("\u267b\ufe0f Settings hot-reloaded from", configPath);
}

let debounceTimer: NodeJS.Timeout | null = null;
export function watchSettings(configPath = "config.json") {
  chokidar.watch(configPath).on("change", () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      log("\ud83d\udd04 Config file changed:", configPath);
      reloadSettings(configPath);
    }, 300);
  });
}

export function loadLocaleLabels(locale: "en" | "zh"): Record<string, string> {
  const file = path.resolve("./locales/", `${locale}.json`);
  try {
    const content = fs.readFileSync(file, "utf-8");
    return JSON.parse(content);
  } catch (e) {
    console.warn("\u26a0\ufe0f Failed to load locale labels:", e);
    return {};
  }
}

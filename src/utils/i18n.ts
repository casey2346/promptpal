// src/utils/i18n.ts

let currentLocale: string = "en";

const translations: Record<string, Record<string, string>> = {
  en: {
    "editor.select_language": "🌐 Select language (en/zh): ",
    "editor.welcome": "🧠 Welcome to the AI Evaluation Editor",
    "editor.enter_prompt": "🔹 Enter prompt: ",
    "editor.enter_response": "🔸 Enter model response: ",
    "editor.enter_model": "🤖 Model used: ",
    "editor.enter_tokens": "🔢 Total tokens used: ",
    "editor.enter_latency": "⏱️ Response latency (ms): ",
    "editor.enter_fallback": "🔁 Was fallback used? (y/N): ",
    "editor.enter_baseline": "📊 GPT baseline score (0-1, optional): ",
    "editor.load_template": "📥 Load sessions from template JSON? (y/N): ",
    "editor.template_path": "📁 Template file path (default: sessions.json): ",
    "editor.evaluated": "✅ Evaluated",
    "editor.evaluation_complete": "✅ Evaluation Complete",
    "editor.final_score": "🎯 Final Score",
    "editor.add_another": "➕ Add another session? (y/N): ",
    "editor.export_csv": "💾 Export results to CSV? (y/N): ",
    "editor.csv_filename": "📂 Enter filename (default: score.csv): ",
    "editor.csv_exported": "✅ CSV Exported.",
    "editor.export_md": "📝 Export markdown summary? (y/N): ",
    "editor.md_filename": "📄 Markdown filename (default: score.md): ",
    "editor.md_exported": "✅ Markdown exported.",
    "editor.export_plot": "📊 Export score plot? (y/N): ",
    "editor.plot_saved": "✅ Plot saved as score_plot.png",
    "editor.save_template": "📦 Save sessions as template JSON? (y/N): ",
    "editor.template_filename": "📁 Filename (default: sessions.json): ",
    "editor.template_saved": "✅ Template JSON saved.",
    "editor.delta_summary": "📈 GPT Score Delta Summary:",
    "editor.mean_delta": "→ Mean Delta",
    "editor.max_delta": "→ Max Delta",
    "editor.min_delta": "→ Min Delta",
  },
  zh: {
    "editor.select_language": "🌐 选择语言 (en/zh): ",
    "editor.welcome": "🧠 欢迎使用 AI 评分编辑器",
    "editor.enter_prompt": "🔹 输入提示词: ",
    "editor.enter_response": "🔸 输入模型回复: ",
    "editor.enter_model": "🤖 模型名称: ",
    "editor.enter_tokens": "🔢 使用的总 token 数: ",
    "editor.enter_latency": "⏱️ 响应时延 (毫秒): ",
    "editor.enter_fallback": "🔁 是否使用 fallback？(y/N): ",
    "editor.enter_baseline": "📊 GPT 基线分数 (0-1, 可选): ",
    "editor.load_template": "📥 是否从 JSON 模板导入？(y/N): ",
    "editor.template_path": "📁 模板文件路径 (默认: sessions.json): ",
    "editor.evaluated": "✅ 已评分",
    "editor.evaluation_complete": "✅ 评分完成",
    "editor.final_score": "🎯 最终得分",
    "editor.add_another": "➕ 继续添加下一个？(y/N): ",
    "editor.export_csv": "💾 是否导出为 CSV？(y/N): ",
    "editor.csv_filename": "📂 CSV 文件名 (默认: score.csv): ",
    "editor.csv_exported": "✅ CSV 已导出",
    "editor.export_md": "📝 是否导出为 Markdown？(y/N): ",
    "editor.md_filename": "📄 Markdown 文件名 (默认: score.md): ",
    "editor.md_exported": "✅ Markdown 已导出",
    "editor.export_plot": "📊 是否导出图表？(y/N): ",
    "editor.plot_saved": "✅ 图表已保存为 score_plot.png",
    "editor.save_template": "📦 是否保存为 JSON 模板？(y/N): ",
    "editor.template_filename": "📁 文件名 (默认: sessions.json): ",
    "editor.template_saved": "✅ 模板已保存",
    "editor.delta_summary": "📈 GPT 分数差值汇总：",
    "editor.mean_delta": "→ 平均差值",
    "editor.max_delta": "→ 最大差值",
    "editor.min_delta": "→ 最小差值",
  },
};

export function setLocale(locale: string) {
  if (translations[locale]) {
    currentLocale = locale;
  } else {
    console.warn(`⚠️ Unsupported locale "${locale}", defaulting to English.`);
    currentLocale = "en";
  }
}

export function t(key: string): string {
  return translations[currentLocale]?.[key] || key;
}

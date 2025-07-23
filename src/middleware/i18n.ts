// src/middleware/i18n.ts
import i18next from "i18next";
import * as middleware from "i18next-http-middleware"; 

i18next.use(middleware.LanguageDetector).init({
  fallbackLng: "en",
  preload: ["en", "zh"],
  resources: {
    en: {
      translation: {
        invalid_input: "Invalid input",
        batch_infer_fail: "Batch inference failed",
      },
    },
    zh: {
      translation: {
        invalid_input: "输入无效",
        batch_infer_fail: "批量推理失败",
      },
    },
  },
});

export default middleware.handle(i18next);

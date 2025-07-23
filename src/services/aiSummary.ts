import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'mock-key',
});

/**
 * Generate AI summary from log text
 */
export async function summarizeLogsAI(logText: string, lang: string = 'en'): Promise<string> {
  const prompt = `
You are an expert DevOps assistant. Summarize the following logs and highlight anomalies or critical issues.

Respond in ${lang === 'zh' ? 'Chinese' : 'English'}.

Logs:
${logText.slice(-4000)}
`;

  const res = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.4,
  });

  return res.choices[0]?.message?.content?.trim() || 'No summary generated.';
}

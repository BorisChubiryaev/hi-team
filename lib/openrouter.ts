// Обёртка над OpenRouter Chat Completions для суммаризации недельных отчётов.
// Ключ берётся только из серверного окружения и никогда не уходит в браузер.

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL =
  process.env.OPENROUTER_MODEL || "deepseek/deepseek-chat-v3-0324:free";

const SYSTEM_PROMPT = `Ты — ассистент, который готовит краткую деловую сводку по еженедельным отчётам команды (аналитика данных и веб-разработка) для руководителя.

Пиши строго по-русски, по делу, без воды. На основе отчётов сотрудников за неделю сформируй сводку по следующей структуре:

1. Ключевые достижения недели (самое важное, что реально сделано; группируй по проектам, а не по людям).
2. Блокеры и риски (что мешает, на что обратить внимание руководителю).
3. Планы на следующую неделю (главные направления).

Требования: будь конкретным, опирайся только на факты из отчётов, не выдумывай. Объединяй повторяющиеся темы. Объём — компактный, удобный для быстрого чтения руководителем (маркированные списки приветствуются).`;

export type WeekReportInput = {
  weekLabel: string;
  reports: {
    name: string;
    projects: {
      name: string;
      done: string;
      blockers: string;
      plans: string;
    }[];
  }[];
};

function buildUserPrompt(input: WeekReportInput): string {
  const lines: string[] = [`Отчёты команды за неделю ${input.weekLabel}.`, ""];
  for (const r of input.reports) {
    lines.push(`### Сотрудник: ${r.name}`);
    if (r.projects.length === 0) {
      lines.push("(нет данных)");
    }
    for (const p of r.projects) {
      lines.push(`Проект: ${p.name || "—"}`);
      if (p.done.trim()) lines.push(`  Сделано: ${p.done.trim()}`);
      if (p.blockers.trim()) lines.push(`  Блокеры: ${p.blockers.trim()}`);
      if (p.plans.trim()) lines.push(`  Планы: ${p.plans.trim()}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

export async function summarizeWeek(
  input: WeekReportInput,
): Promise<{ content: string; model: string }> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY не задан в окружении");
  }

  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      // OpenRouter использует эти заголовки для рейтинга/атрибуции приложения.
      "HTTP-Referer": process.env.APP_URL || "http://localhost:3000",
      "X-Title": "hi-team",
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      temperature: 0.3,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(input) },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenRouter ${res.status}: ${text.slice(0, 300)}`);
  }

  const data = await res.json();
  const content: string | undefined = data?.choices?.[0]?.message?.content;
  if (!content || !content.trim()) {
    throw new Error("Модель вернула пустой ответ");
  }
  return { content: content.trim(), model: data.model || DEFAULT_MODEL };
}

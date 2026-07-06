// Обёртка над OpenRouter Chat Completions для суммаризации недельных отчётов.
// Ключ берётся только из серверного окружения и никогда не уходит в браузер.

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL =
  process.env.OPENROUTER_MODEL || "google/gemini-2.0-flash-001";

const SYSTEM_PROMPT = `Ты — ассистент, который готовит краткую деловую сводку по еженедельным отчётам команды (аналитика данных и веб-разработка) для руководителя.

Пиши строго по-русски, по делу, без воды. На основе отчётов сотрудников за неделю сформируй сводку по следующей структуре:

1. Ключевые достижения недели (самое важное, что реально сделано; группируй по проектам, а не по людям).
2. Блокеры и риски (что мешает, на что обратить внимание руководителю).
3. Планы на следующую неделю (главные направления).

Требования: будь конкретным, опирайся только на факты из отчётов, не выдумывай. Объединяй повторяющиеся темы. Объём — компактный, удобный для быстрого чтения руководителем (маркированные списки приветствуются).

Если в конце будет раздел «Блокеры прошлых недель» — сравни с текущими блокерами и явно пометь те, что повторяются (например: «блокер тянется вторую неделю»). Прошлые блокеры, которых больше нет, не упоминай.`;

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
  /** Блокеры прошлых недель — контекст для выявления «висящих» блокеров. */
  previousBlockers?: {
    weekLabel: string;
    userName: string;
    projectName: string;
    blockers: string;
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

  if (input.previousBlockers && input.previousBlockers.length > 0) {
    lines.push("### Блокеры прошлых недель (контекст, не пересказывать)");
    for (const b of input.previousBlockers) {
      lines.push(
        `- [${b.weekLabel}] ${b.userName}, проект «${b.projectName || "—"}»: ${b.blockers}`,
      );
    }
    lines.push("");
  }

  return lines.join("\n");
}

async function callOpenRouter(
  messages: { role: "system" | "user"; content: string }[],
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
      messages,
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

export async function summarizeWeek(
  input: WeekReportInput,
): Promise<{ content: string; model: string }> {
  return callOpenRouter([
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: buildUserPrompt(input) },
  ]);
}

// ---------------------------------------------------------------------------
// Сводка по проекту за период (для отчётности наверх)
// ---------------------------------------------------------------------------

const PROJECT_SYSTEM_PROMPT = `Ты — ассистент, который готовит краткий статус проекта по выдержкам из еженедельных отчётов команды. Читатель — руководитель, которому нужно отчитаться о проекте наверх.

Пиши строго по-русски, по делу, без воды. Структура:

1. Текущее состояние проекта (1–3 предложения: что это и где мы сейчас).
2. Что сделано за период (сгруппируй по темам, а не по неделям).
3. Открытые блокеры и риски (особо отметь блокеры, которые повторяются из недели в неделю).
4. Ближайшие планы.

Требования: опирайся только на факты из отчётов, не выдумывай. Компактно, маркированные списки приветствуются.`;

export type ProjectHistoryInput = {
  projectName: string;
  weeks: {
    weekLabel: string;
    entries: {
      userName: string;
      done: string;
      blockers: string;
      plans: string;
    }[];
  }[];
};

function buildProjectPrompt(input: ProjectHistoryInput): string {
  const lines: string[] = [
    `Выдержки из еженедельных отчётов по проекту «${input.projectName}» (от старых недель к новым).`,
    "",
  ];
  for (const w of input.weeks) {
    lines.push(`### Неделя ${w.weekLabel}`);
    for (const e of w.entries) {
      lines.push(`Сотрудник: ${e.userName}`);
      if (e.done.trim()) lines.push(`  Сделано: ${e.done.trim()}`);
      if (e.blockers.trim()) lines.push(`  Блокеры: ${e.blockers.trim()}`);
      if (e.plans.trim()) lines.push(`  Планы: ${e.plans.trim()}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

export async function summarizeProject(
  input: ProjectHistoryInput,
): Promise<{ content: string; model: string }> {
  return callOpenRouter([
    { role: "system", content: PROJECT_SYSTEM_PROMPT },
    { role: "user", content: buildProjectPrompt(input) },
  ]);
}

// ---------------------------------------------------------------------------
// Сводка месяца (для отчётности наверх)
// ---------------------------------------------------------------------------

const MONTH_SYSTEM_PROMPT = `Ты — ассистент, который готовит итоги месяца по еженедельным отчётам команды (аналитика данных и веб-разработка). Читатель — руководитель, которому нужно отчитаться о месяце наверх.

Пиши строго по-русски, по делу, без воды. Структура:

1. Главные итоги месяца (3–5 пунктов: самое значимое, сгруппировано по проектам).
2. Состояние ключевых проектов (по каждому крупному проекту: 1–2 предложения о прогрессе за месяц).
3. Блокеры и риски (в первую очередь те, что не решались несколько недель).
4. Фокус следующего месяца (из планов последних недель).

Требования: опирайся только на факты из отчётов и недельных сводок, не выдумывай. Не пересказывай по неделям — агрегируй за месяц. Компактно, маркированные списки приветствуются.`;

export type MonthInput = {
  monthLabel: string;
  weeks: {
    weekLabel: string;
    /** Недельная AI-сводка, если уже есть, — компактнее сырых отчётов. */
    summary: string | null;
    reports: WeekReportInput["reports"];
  }[];
};

function buildMonthPrompt(input: MonthInput): string {
  const lines: string[] = [
    `Материалы за ${input.monthLabel} (недели от старых к новым).`,
    "",
  ];
  for (const w of input.weeks) {
    lines.push(`## Неделя ${w.weekLabel}`);
    if (w.summary?.trim()) {
      lines.push("Готовая сводка недели:", w.summary.trim());
    } else {
      for (const r of w.reports) {
        lines.push(`### Сотрудник: ${r.name}`);
        for (const p of r.projects) {
          lines.push(`Проект: ${p.name || "—"}`);
          if (p.done.trim()) lines.push(`  Сделано: ${p.done.trim()}`);
          if (p.blockers.trim()) lines.push(`  Блокеры: ${p.blockers.trim()}`);
          if (p.plans.trim()) lines.push(`  Планы: ${p.plans.trim()}`);
        }
      }
    }
    lines.push("");
  }
  return lines.join("\n");
}

export async function summarizeMonth(
  input: MonthInput,
): Promise<{ content: string; model: string }> {
  return callOpenRouter([
    { role: "system", content: MONTH_SYSTEM_PROMPT },
    { role: "user", content: buildMonthPrompt(input) },
  ]);
}

// ---------------------------------------------------------------------------
// Разбор свободного текста отчёта (для Telegram-бота) в структуру проектов
// ---------------------------------------------------------------------------

const PARSE_SYSTEM_PROMPT = `Ты разбираешь свободное сообщение сотрудника о рабочей неделе в структурированный отчёт по проектам.

Верни СТРОГО JSON — массив объектов вида:
[{"name": "...", "done": "...", "blockers": "...", "plans": "..."}]

Правила:
- Один объект на проект/направление. Если проект не назван явно — используй "name": "Общее".
- "done" — что сделано, "blockers" — что мешает (пусто, если нет), "plans" — планы на следующую неделю (пусто, если нет).
- Опирайся только на текст, ничего не выдумывай. Сохраняй формулировки автора, только приводи в порядок.
- Никакого текста вне JSON, без пояснений, без markdown-ограждений.`;

/** Достаёт JSON-массив из ответа модели (снимает ```-ограждения и мусор по краям). */
function extractJsonArray(text: string): unknown {
  let s = text.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  const start = s.indexOf("[");
  const end = s.lastIndexOf("]");
  if (start !== -1 && end !== -1 && end > start) s = s.slice(start, end + 1);
  return JSON.parse(s);
}

export type ParsedProject = {
  name: string;
  done: string;
  blockers: string;
  plans: string;
};

/**
 * Превращает свободный текст в список проектов. При сбое разбора возвращает
 * один проект «Общее» со всем текстом в «Сделано» — чтобы бот не терял ввод.
 */
export async function parseReportText(text: string): Promise<ParsedProject[]> {
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  try {
    const { content } = await callOpenRouter([
      { role: "system", content: PARSE_SYSTEM_PROMPT },
      { role: "user", content: text },
    ]);
    const parsed = extractJsonArray(content);
    if (Array.isArray(parsed)) {
      const projects = parsed
        .map((p) => {
          const o = (p ?? {}) as Record<string, unknown>;
          return {
            name: str(o.name) || "Общее",
            done: str(o.done),
            blockers: str(o.blockers),
            plans: str(o.plans),
          };
        })
        .filter((p) => p.done || p.blockers || p.plans);
      if (projects.length > 0) return projects;
    }
  } catch (e) {
    console.error("parseReportText:", e instanceof Error ? e.message : e);
  }
  return [{ name: "Общее", done: text.trim(), blockers: "", plans: "" }];
}

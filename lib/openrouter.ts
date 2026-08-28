// Обёртка над OpenRouter Chat Completions для суммаризации недельных отчётов.
// Ключ берётся только из серверного окружения и никогда не уходит в браузер.

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
// Бесплатная модель (:free) — работает при нулевом балансе OpenRouter, без 402
// по кредитам. У бесплатного тарифа свои rate-limit'ы; для платного качества
// задайте OPENROUTER_MODEL (напр. google/gemini-2.0-flash-001) + пополните счёт.
const DEFAULT_MODEL =
  process.env.OPENROUTER_MODEL || "meta-llama/llama-3.3-70b-instruct:free";

// Запасные бесплатные модели: если основная недоступна (404 «No endpoints
// found» — модель сняли/переименовали), по очереди пробуем эти. Так даже
// мёртвая модель в OPENROUTER_MODEL не роняет все AI-вызовы.
const FALLBACK_MODELS = [
  "meta-llama/llama-3.3-70b-instruct:free",
  "deepseek/deepseek-chat-v3-0324:free",
  "google/gemma-3-27b-it:free",
];

// Ограничиваем длину ответа: без max_tokens OpenRouter резервирует полное окно
// модели (десятки тысяч токенов) и падает с 402, если на балансе меньше кредитов.
// Наши сводки короткие — 2048 токенов с запасом хватает.
const MAX_TOKENS = Number(process.env.OPENROUTER_MAX_TOKENS) || 2048;

const SYSTEM_PROMPT = `Ты — ассистент, который готовит краткую деловую сводку по еженедельным отчётам команды для руководителя. Команда может делиться на подкоманды (направления).

Пиши строго по-русски, по делу, без воды. В отчётах сотрудники сгруппированы по подкомандам заголовками уровня «## <название>». Сохрани это деление: сделай верхнеуровневый раздел на каждую подкоманду, встреченную в отчётах (в том же порядке); сотрудников без подкоманды собери в разделе «## Без подкоманды». Пустые разделы не создавай.

Внутри каждого раздела подкоманды придерживайся структуры:

1. Ключевые достижения недели (самое важное, что реально сделано; группируй по проектам, а не по людям).
2. Блокеры и риски (что мешает, на что обратить внимание руководителю).
3. Планы на следующую неделю (главные направления).

Требования: будь конкретным, опирайся только на факты из отчётов, не выдумывай. Объединяй повторяющиеся темы. Объём — компактный, удобный для быстрого чтения руководителем (маркированные списки приветствуются).

Если в конце будет раздел «Блокеры прошлых недель» — сравни с текущими блокерами и явно пометь те, что повторяются (например: «блокер тянется вторую неделю»). Прошлые блокеры, которых больше нет, не упоминай.`;

export type WeekReportInput = {
  weekLabel: string;
  reports: {
    name: string;
    /** Название подкоманды автора; null — ещё не выбрана. */
    subteam?: string | null;
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

  // Группируем отчёты по подкомандам (в порядке первого появления), чтобы
  // модель делила сводку по разделам. Набор подкоманд задаётся командой.
  const labels: string[] = [];
  for (const r of input.reports) {
    const s = r.subteam?.trim();
    if (s && !labels.includes(s)) labels.push(s);
  }
  const groups: { title: string; match: (s?: string | null) => boolean }[] = [
    ...labels.map((label) => ({
      title: label,
      match: (s?: string | null) => (s ?? "").trim() === label,
    })),
    { title: "Без подкоманды", match: (s?: string | null) => !s?.trim() },
  ];

  for (const g of groups) {
    const reports = input.reports.filter((r) => g.match(r.subteam));
    if (reports.length === 0) continue;
    lines.push(`## ${g.title}`, "");
    for (const r of reports) {
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

// Ниже этого лимита ответы бессмысленно обрезаны — значит на балансе почти
// не осталось кредитов; честно просим пополнить, а не молча портим ответ.
const MIN_AFFORDABLE_TOKENS = 400;

/** Один HTTP-запрос к OpenRouter конкретной моделью и с заданным max_tokens. */
async function openRouterRequest(
  apiKey: string,
  model: string,
  messages: { role: "system" | "user"; content: string }[],
  maxTokens: number,
): Promise<Response> {
  return fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      // OpenRouter использует эти заголовки для рейтинга/атрибуции приложения.
      "HTTP-Referer": process.env.APP_URL || "http://localhost:3000",
      "X-Title": "hi-team",
    },
    body: JSON.stringify({
      model,
      temperature: 0.3,
      max_tokens: maxTokens,
      messages,
    }),
  });
}

/** Модели-кандидаты: сначала выбранная, затем запасные (без дублей). */
function modelCandidates(): string[] {
  const seen = new Set<string>();
  return [DEFAULT_MODEL, ...FALLBACK_MODELS].filter((m) => {
    if (seen.has(m)) return false;
    seen.add(m);
    return true;
  });
}

async function callOpenRouter(
  messages: { role: "system" | "user"; content: string }[],
  opts: { maxTokens?: number } = {},
): Promise<{ content: string; model: string }> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY не задан в окружении");
  }

  const wantTokens = opts.maxTokens ?? MAX_TOKENS;
  let unavailable = ""; // текст последней 404 «нет эндпоинтов»

  for (const model of modelCandidates()) {
    let res = await openRouterRequest(apiKey, model, messages, wantTokens);

    // Модель снята/переименована — пробуем следующую из запасных.
    if (res.status === 404) {
      unavailable = `${model}: ${(await res.text()).slice(0, 200)}`;
      continue;
    }

    // На аккаунте мало кредитов: OpenRouter отдаёт 402 и сообщает, сколько
    // токенов сейчас «по карману». Подстраиваемся и повторяем один раз.
    if (res.status === 402) {
      const text = await res.text();
      const afford = Number(text.match(/can only afford (\d+)/)?.[1]);
      if (Number.isFinite(afford) && afford >= MIN_AFFORDABLE_TOKENS) {
        res = await openRouterRequest(apiKey, model, messages, afford);
      } else {
        throw new Error(
          "Недостаточно кредитов OpenRouter для ответа. Пополните баланс " +
            "или выберите бесплатную модель (OPENROUTER_MODEL): " +
            "https://openrouter.ai/settings/credits",
        );
      }
    }

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`OpenRouter ${res.status}: ${text.slice(0, 300)}`);
    }

    const data = await res.json();
    const content: string | undefined = data?.choices?.[0]?.message?.content;
    if (!content || !content.trim()) {
      throw new Error("Модель вернула пустой ответ");
    }
    return { content: content.trim(), model: data.model || model };
  }

  throw new Error(
    `Ни одна модель OpenRouter недоступна. Проверьте OPENROUTER_MODEL. ${unavailable}`.trim(),
  );
}

export async function summarizeWeek(
  input: WeekReportInput,
  systemPrompt?: string | null,
): Promise<{ content: string; model: string }> {
  return callOpenRouter([
    { role: "system", content: systemPrompt?.trim() || SYSTEM_PROMPT },
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
  systemPrompt?: string | null,
): Promise<{ content: string; model: string }> {
  return callOpenRouter([
    { role: "system", content: systemPrompt?.trim() || MONTH_SYSTEM_PROMPT },
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

// ---------------------------------------------------------------------------
// Подготовка сотрудника к встрече 1:1 с руководителем (личное резюме за период)
// ---------------------------------------------------------------------------

const REVIEW_SYSTEM_PROMPT = `Ты — карьерный ассистент. Помогаешь сотруднику (аналитика данных / веб-разработка) подготовиться к ежеквартальной встрече один на один с руководителем. На основе его СОБСТВЕННЫХ недельных отчётов за период собери материалы, чтобы он выступил уверенно, честно и по делу.

Пиши строго по-русски, от первого лица («я сделал», «мне удалось»), уверенно, но без хвастовства и воды. Опирайся ТОЛЬКО на факты из отчётов — ничего не выдумывай и не преувеличивай. Где возможно, переводи процесс в результат и пользу для команды/бизнеса. Если данных мало — честно отметь это и подскажи, что стоит добавить к разговору.

Ответ — в Markdown, ровно с такими разделами (заголовки уровня ##):

## Главные достижения
3–6 пунктов с акцентом на результат и ценность, а не на рутину. Объединяй связанное.

## Вклад по проектам
По каждому значимому проекту — 1–2 фразы: что я двигал и к чему это привело.

## Преодолённые сложности
Блокеры и как я с ними справлялся (это показывает умение решать проблемы). Если блокер не закрыт — скажи честно и предложи план.

## Рост и развитие
Новые области, навыки и зоны ответственности, освоенные за период.

## Планы и амбиции на следующий квартал
Куда хочу расти и что готов взять на себя (на основе планов из отчётов).

## Что обсудить с руководителем
3–5 готовых реплик и вопросов для разговора: где нужна поддержка, ресурсы, обратная связь или развитие. Формулируй так, чтобы можно было произнести вслух.

Если в конце дан «Личный акцент» — учти его при расстановке приоритетов, но не в ущерб честности.`;

export type ReviewInput = {
  periodLabel: string;
  userName: string;
  focus?: string;
  stats: {
    weeksReported: number;
    weeksTotal: number;
    projects: number;
    blockers: number;
  };
  projects: {
    name: string;
    weeks: {
      weekLabel: string;
      done: string;
      blockers: string;
      plans: string;
    }[];
  }[];
};

function buildReviewPrompt(input: ReviewInput): string {
  const lines: string[] = [
    `Сотрудник: ${input.userName}. Период: ${input.periodLabel}.`,
    `За период: сдано отчётов за ${input.stats.weeksReported} из ${input.stats.weeksTotal} недель; проектов — ${input.stats.projects}; записей с блокерами — ${input.stats.blockers}.`,
    "",
    "Выдержки из его недельных отчётов, сгруппированные по проектам (от старых недель к новым):",
    "",
  ];
  for (const p of input.projects) {
    lines.push(`### Проект: ${p.name || "—"}`);
    for (const w of p.weeks) {
      lines.push(`Неделя ${w.weekLabel}:`);
      if (w.done.trim()) lines.push(`  Сделано: ${w.done.trim()}`);
      if (w.blockers.trim()) lines.push(`  Блокеры: ${w.blockers.trim()}`);
      if (w.plans.trim()) lines.push(`  Планы: ${w.plans.trim()}`);
    }
    lines.push("");
  }
  if (input.focus?.trim()) {
    lines.push(`Личный акцент от сотрудника: ${input.focus.trim()}`);
  }
  return lines.join("\n");
}

export async function writeReviewPrep(
  input: ReviewInput,
): Promise<{ content: string; model: string }> {
  return callOpenRouter([
    { role: "system", content: REVIEW_SYSTEM_PROMPT },
    { role: "user", content: buildReviewPrompt(input) },
  ]);
}

// ---------------------------------------------------------------------------
// Улучшение формулировок отчёта (кнопка «Улучшить с ИИ»)
// ---------------------------------------------------------------------------

const IMPROVE_SYSTEM_PROMPT = `Ты — редактор рабочих еженедельных отчётов. Тебе дают поля отчёта по проектам: «Сделано» (done), «Блокеры» (blockers), «Планы» (plans). Твоя задача — улучшить ЧИТАЕМОСТЬ и грамотность, СОХРАНИВ всю информацию.

ГЛАВНОЕ ПРАВИЛО: ничего не терять по смыслу. Сохраняй КАЖДЫЙ факт, деталь, название, цифру и пункт из исходного текста. НЕ сокращай, НЕ обобщай, НЕ выбрасывай подробности — даже мелкие. Улучшение — это НЕ сокращение; объём обычно остаётся тем же или чуть больше (за счёт структуры), но не меньше.

Что делать:
- Исправлять грамматику, опечатки, пунктуацию, согласование.
- Делать формулировки понятнее и связнее; убирать только буквальные дубли одного и того же (не содержательные повторы).
- Если в поле несколько разных пунктов — оформлять их списком: каждый пункт с новой строки, начиная с «- », сохраняя ВСЕ пункты.
- «Сделано» — приводить к прошедшему времени: если написано как план (будущее: «сделаю», «планирую», «нужно») — переформулируй в прошедшее («сделал», «подключил»), сохраняя все детали.
- «Планы» — будущее время.

Что НЕЛЬЗЯ:
- Придумывать факты, результаты, цифры, детали, которых нет во входе. Не приукрашивать.
- Удалять или «схлопывать» содержательные детали ради краткости.
- Менять названия проектов.
- Заполнять пустое поле — оставляй пустым (пустая строка).

Верни СТРОГО JSON — массив объектов {"name","done","blockers","plans"} в ТОМ ЖЕ порядке и количестве, что на входе. Никакого текста вне JSON, без markdown-ограждений.`;

export type ImproveProject = {
  name: string;
  done: string;
  blockers: string;
  plans: string;
};

/** Улучшает формулировки полей отчёта, не добавляя новых фактов. */
export async function improveProjects(
  projects: ImproveProject[],
): Promise<ImproveProject[]> {
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const input = projects.map((p) => ({
    name: p.name,
    done: p.done,
    blockers: p.blockers,
    plans: p.plans,
  }));

  const { content } = await callOpenRouter([
    { role: "system", content: IMPROVE_SYSTEM_PROMPT },
    { role: "user", content: JSON.stringify(input) },
  ]);

  const parsed = extractJsonArray(content);
  if (!Array.isArray(parsed) || parsed.length !== projects.length) {
    throw new Error("Модель вернула неожиданный ответ");
  }
  return parsed.map((p, i) => {
    const o = (p ?? {}) as Record<string, unknown>;
    return {
      name: projects[i].name, // имя проекта не трогаем
      done: str(o.done),
      blockers: str(o.blockers),
      plans: str(o.plans),
    };
  });
}

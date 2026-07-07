// Логика Telegram-бота: привязка аккаунта, приём отчёта свободным текстом
// (AI-разбор + подтверждение кнопкой), статус недели. Состояние диалога
// хранится в БД (TelegramDialog), т.к. serverless без общей памяти.

import { prisma } from "@/lib/db";
import { saveUserReport, type ProjectInput } from "@/lib/reports";
import {
  answerCallbackQuery,
  editMessageText,
  sendMessage,
} from "@/lib/telegram";
import {
  currentWeekRange,
  EDITABLE_WEEKS,
  formatWeekLabel,
  isoDate,
  recentWeeks,
} from "@/lib/weeks";

// Шаги пошагового мастера отчёта (состояние в TelegramDialog.state).
const STEP = {
  WEEK: "g_week",
  NAME: "g_name",
  DONE: "g_done",
  BLOCKERS: "g_blockers",
  PLANS: "g_plans",
} as const;
const FLOW_STATES: string[] = Object.values(STEP);

// Черновик мастера: уже добавленные проекты + текущий заполняемый.
type Draft = { projects: ProjectInput[]; cur: Partial<ProjectInput> };

type IncomingMessage = {
  chat: { id: number; type?: string; title?: string };
  from?: { id?: number; username?: string };
  text?: string;
};

type CallbackQuery = {
  id: string;
  data?: string;
  message?: { chat: { id: number }; message_id: number };
};

export type Update = {
  message?: IncomingMessage;
  callback_query?: CallbackQuery;
};

const HELP = [
  "Я бот команды hi-team. Что умею:",
  "",
  "/report — заполнить недельный отчёт по шагам (проект → сделано → блокеры → планы)",
  "/status — сдан ли мой отчёт за текущую неделю",
  "/cancel — прервать заполнение отчёта",
  "/help — эта справка",
].join("\n");

function appUrl(): string {
  return process.env.APP_URL || "http://localhost:3000";
}

/** Пользователь, привязанный к этому чату (активный), либо null. */
async function linkedUser(chatId: number) {
  const user = await prisma.user.findUnique({
    where: { telegramChatId: String(chatId) },
  });
  return user && user.active ? user : null;
}

/** Читает черновик мастера отчёта из БД (или null, если диалога нет). */
async function loadFlow(chatId: number): Promise<{
  state: string;
  weekStartIso: string | null;
  draft: Draft;
} | null> {
  const d = await prisma.telegramDialog.findUnique({
    where: { chatId: String(chatId) },
  });
  if (!d) return null;
  let draft: Draft = { projects: [], cur: {} };
  if (d.draft) {
    try {
      draft = JSON.parse(d.draft) as Draft;
    } catch {
      draft = { projects: [], cur: {} };
    }
  }
  return { state: d.state, weekStartIso: d.weekStartIso, draft };
}

async function saveFlow(
  chatId: number,
  state: string,
  weekStartIso: string | null,
  draft: Draft,
) {
  await setDialog(chatId, state, {
    weekStartIso,
    draft: JSON.stringify(draft),
  });
}

async function setDialog(
  chatId: number,
  state: string,
  data: { weekStartIso?: string | null; draft?: string | null } = {},
) {
  const payload = {
    state,
    weekStartIso: data.weekStartIso ?? null,
    draft: data.draft ?? null,
  };
  await prisma.telegramDialog.upsert({
    where: { chatId: String(chatId) },
    update: payload,
    create: { chatId: String(chatId), ...payload },
  });
}

async function clearDialog(chatId: number) {
  await prisma.telegramDialog
    .delete({ where: { chatId: String(chatId) } })
    .catch(() => {});
}

// --- команды ---------------------------------------------------------------

async function handleStart(msg: IncomingMessage, arg: string) {
  const chatId = msg.chat.id;

  if (arg) {
    const link = await prisma.telegramLink.findUnique({ where: { code: arg } });
    if (!link || link.expiresAt < new Date()) {
      await sendMessage(
        chatId,
        "Код привязки недействителен или истёк. Откройте «Настройки» в приложении и получите новый.",
      );
      return;
    }
    // Освобождаем chatId, если он был привязан к другому аккаунту.
    await prisma.user.updateMany({
      where: { telegramChatId: String(chatId) },
      data: { telegramChatId: null },
    });
    const user = await prisma.user.update({
      where: { id: link.userId },
      data: {
        telegramChatId: String(chatId),
        telegramUsername: msg.from?.username ?? null,
      },
    });
    await prisma.telegramLink.delete({ where: { code: arg } }).catch(() => {});
    await sendMessage(
      chatId,
      `Готово, аккаунт привязан: ${user.name ?? user.email}.\n\n${HELP}`,
    );
    return;
  }

  const user = await linkedUser(chatId);
  if (user) {
    await sendMessage(chatId, `С возвращением, ${user.name ?? user.email}!\n\n${HELP}`);
  } else {
    await sendMessage(
      chatId,
      `Привет! Чтобы пользоваться ботом, привяжите аккаунт: откройте «Настройки» в приложении (${appUrl()}/settings) и нажмите «Подключить Telegram».`,
    );
  }
}

/** /here — регистрирует групповой чат для сводок. Только руководитель. */
async function handleHere(msg: IncomingMessage) {
  const chatId = msg.chat.id;
  const inGroup =
    msg.chat.type === "group" || msg.chat.type === "supergroup";

  if (!inGroup) {
    await sendMessage(
      chatId,
      "Эту команду нужно отправить в групповом чате, куда добавлен бот.",
    );
    return;
  }

  // В группе chat_id отправителя равен его user_id, который совпадает с
  // telegramChatId привязанного аккаунта (личный чат). Так опознаём лида.
  const fromId = msg.from?.id;
  const lead = fromId
    ? await prisma.user.findUnique({
        where: { telegramChatId: String(fromId) },
      })
    : null;

  if (!lead || lead.role !== "LEAD" || !lead.active) {
    await sendMessage(
      chatId,
      "Подключить чат может только руководитель с привязанным аккаунтом. " +
        "Откройте бота в личке и привяжите аккаунт в «Настройках».",
    );
    return;
  }

  await prisma.botSettings.upsert({
    where: { id: "singleton" },
    update: {
      groupChatId: String(chatId),
      groupTitle: msg.chat.title ?? null,
      groupEnabled: true,
    },
    create: {
      id: "singleton",
      groupChatId: String(chatId),
      groupTitle: msg.chat.title ?? null,
      groupEnabled: true,
    },
  });

  await sendMessage(
    chatId,
    "✅ Готово! Этот чат подключён для сводок по отчётам. " +
      "День и время настраиваются в разделе «Команда» на сайте.",
  );
}

const CANCEL_BTN = { text: "✖️ Отмена", callback_data: "gcancel" };

async function handleReport(chatId: number) {
  const user = await linkedUser(chatId);
  if (!user) {
    await sendMessage(
      chatId,
      `Сначала привяжите аккаунт в «Настройках»: ${appUrl()}/settings`,
    );
    return;
  }

  await saveFlow(chatId, STEP.WEEK, null, { projects: [], cur: {} });
  const weeks = recentWeeks(EDITABLE_WEEKS);
  const buttons = weeks.map((w, i) => [
    {
      text: i === 0 ? `${w.label} (текущая)` : w.label,
      callback_data: `gw:${isoDate(w.start)}`,
    },
  ]);
  buttons.push([CANCEL_BTN]);
  await sendMessage(chatId, "За какую неделю заполняем отчёт?", buttons);
}

/** Пользователь выбрал неделю (кнопка) — начинаем ввод проектов. */
async function startProjects(
  chatId: number,
  messageId: number,
  iso: string,
) {
  const week = recentWeeks(EDITABLE_WEEKS).find((w) => isoDate(w.start) === iso);
  if (!week) {
    await editMessageText(chatId, messageId, "Эту неделю уже нельзя заполнить.");
    await clearDialog(chatId);
    return;
  }
  await saveFlow(chatId, STEP.NAME, iso, { projects: [], cur: {} });
  await editMessageText(chatId, messageId, `📝 Отчёт за неделю ${week.label}`);
  await sendMessage(
    chatId,
    "Название первого проекта или направления:",
    [[CANCEL_BTN]],
  );
}

/** Сохраняет собранный черновик как отчёт. */
async function saveGuidedReport(
  chatId: number,
  messageId: number,
  cbId: string,
) {
  const flow = await loadFlow(chatId);
  const user = await linkedUser(chatId);
  if (!user || !flow || !flow.weekStartIso) {
    await answerCallbackQuery(cbId, "Нечего сохранять");
    await editMessageText(chatId, messageId, "Черновик не найден. Заново — /report.");
    await clearDialog(chatId);
    return;
  }
  if (flow.draft.projects.length === 0) {
    await answerCallbackQuery(cbId, "Добавьте хотя бы один проект");
    return;
  }
  try {
    const count = await saveUserReport(
      user.id,
      flow.weekStartIso,
      flow.draft.projects,
    );
    const week = recentWeeks(EDITABLE_WEEKS).find(
      (w) => isoDate(w.start) === flow.weekStartIso,
    );
    await clearDialog(chatId);
    await answerCallbackQuery(cbId, "Сохранено");
    await editMessageText(
      chatId,
      messageId,
      `✅ Отчёт за неделю ${week?.label ?? ""} сохранён: ${count} проект(ов). Спасибо!`,
    );
  } catch (e) {
    console.error("bot guided save:", e instanceof Error ? e.message : e);
    await answerCallbackQuery(cbId, "Ошибка");
    await editMessageText(
      chatId,
      messageId,
      "Не удалось сохранить отчёт. Попробуйте позже или заполните на сайте.",
    );
  }
}

/** /cancel — прервать мастер отчёта. */
async function handleCancel(chatId: number) {
  const flow = await loadFlow(chatId);
  await clearDialog(chatId);
  await sendMessage(
    chatId,
    flow && FLOW_STATES.includes(flow.state)
      ? "Заполнение отменено. Начать заново — /report."
      : "Нечего отменять. Начать отчёт — /report.",
  );
}

/** /done — сохранить собранный отчёт (альтернатива кнопке «Готово»). */
async function handleDoneCommand(chatId: number) {
  const flow = await loadFlow(chatId);
  const user = await linkedUser(chatId);
  if (
    !user ||
    !flow ||
    !FLOW_STATES.includes(flow.state) ||
    !flow.weekStartIso ||
    flow.draft.projects.length === 0
  ) {
    await sendMessage(
      chatId,
      "Пока нечего сохранять. Заполните отчёт по шагам — /report.",
    );
    return;
  }
  try {
    const count = await saveUserReport(
      user.id,
      flow.weekStartIso,
      flow.draft.projects,
    );
    const week = recentWeeks(EDITABLE_WEEKS).find(
      (w) => isoDate(w.start) === flow.weekStartIso,
    );
    await clearDialog(chatId);
    await sendMessage(
      chatId,
      `✅ Отчёт за неделю ${week?.label ?? ""} сохранён: ${count} проект(ов). Спасибо!`,
    );
  } catch (e) {
    console.error("bot /done save:", e instanceof Error ? e.message : e);
    await sendMessage(
      chatId,
      "Не удалось сохранить отчёт. Попробуйте позже или заполните на сайте.",
    );
  }
}

async function handleStatus(chatId: number) {
  const user = await linkedUser(chatId);
  if (!user) {
    await sendMessage(chatId, `Аккаунт не привязан: ${appUrl()}/settings`);
    return;
  }
  const { start, end } = currentWeekRange();
  const label = formatWeekLabel(start, end);
  const week = await prisma.week.findUnique({ where: { startDate: start } });
  const report = week
    ? await prisma.report.findUnique({
        where: { userId_weekId: { userId: user.id, weekId: week.id } },
        include: { projects: true },
      })
    : null;

  if (report && report.projects.length > 0) {
    await sendMessage(
      chatId,
      `Отчёт за неделю ${label} сдан: ${report.projects.length} проект(ов). Чтобы обновить — /report.`,
    );
  } else {
    await sendMessage(
      chatId,
      `Отчёт за неделю ${label} ещё не сдан. Отправить — /report.`,
    );
  }
}

// --- свободный текст (контент отчёта) --------------------------------------

async function handleText(chatId: number, text: string) {
  const flow = await loadFlow(chatId);

  if (flow && FLOW_STATES.includes(flow.state)) {
    const user = await linkedUser(chatId);
    if (!user) {
      await clearDialog(chatId);
      await sendMessage(chatId, `Аккаунт не привязан: ${appUrl()}/settings`);
      return;
    }

    const value = text.trim();
    const norm = value === "-" ? "" : value; // «-» = пропустить поле

    switch (flow.state) {
      case STEP.WEEK:
        await sendMessage(
          chatId,
          "Выберите неделю кнопкой выше 👆 или /cancel, чтобы отменить.",
        );
        return;

      case STEP.NAME:
        flow.draft.cur = { name: value };
        await saveFlow(chatId, STEP.DONE, flow.weekStartIso, flow.draft);
        await sendMessage(
          chatId,
          `Проект «${value}». Что сделано за неделю? (или «-», если нечего)`,
        );
        return;

      case STEP.DONE:
        flow.draft.cur.done = norm;
        await saveFlow(chatId, STEP.BLOCKERS, flow.weekStartIso, flow.draft);
        await sendMessage(chatId, "Блокеры? (или «-», если нет)");
        return;

      case STEP.BLOCKERS:
        flow.draft.cur.blockers = norm;
        await saveFlow(chatId, STEP.PLANS, flow.weekStartIso, flow.draft);
        await sendMessage(chatId, "Планы на следующую неделю? (или «-»)");
        return;

      case STEP.PLANS: {
        flow.draft.cur.plans = norm;
        const cur = flow.draft.cur;
        flow.draft.projects.push({
          name: cur.name ?? "",
          done: cur.done ?? "",
          blockers: cur.blockers ?? "",
          plans: cur.plans ?? "",
        });
        flow.draft.cur = {};
        await saveFlow(chatId, STEP.NAME, flow.weekStartIso, flow.draft);
        await sendMessage(
          chatId,
          `✅ Проект «${cur.name}» добавлен (всего ${flow.draft.projects.length}).\n\n` +
            "Название следующего проекта — или нажмите «Готово».",
          [
            [
              { text: "✅ Готово (сохранить)", callback_data: "gdone" },
              CANCEL_BTN,
            ],
          ],
        );
        return;
      }
    }
  }

  const user = await linkedUser(chatId);
  await sendMessage(
    chatId,
    user
      ? "Чтобы отправить отчёт, наберите /report. Справка — /help."
      : `Привяжите аккаунт в «Настройках»: ${appUrl()}/settings`,
  );
}

// --- подтверждение (inline-кнопки) -----------------------------------------

async function handleCallback(cb: CallbackQuery) {
  const chatId = cb.message?.chat.id;
  const messageId = cb.message?.message_id;
  if (chatId == null || messageId == null) {
    await answerCallbackQuery(cb.id);
    return;
  }

  const data = cb.data ?? "";

  if (data === "gcancel") {
    await clearDialog(chatId);
    await answerCallbackQuery(cb.id, "Отменено");
    await editMessageText(
      chatId,
      messageId,
      "Заполнение отменено. Начать заново — /report.",
    );
    return;
  }

  if (data.startsWith("gw:")) {
    await answerCallbackQuery(cb.id);
    await startProjects(chatId, messageId, data.slice(3));
    return;
  }

  if (data === "gdone") {
    await saveGuidedReport(chatId, messageId, cb.id);
    return;
  }

  await answerCallbackQuery(cb.id);
}

// --- точка входа -----------------------------------------------------------

export async function handleUpdate(update: Update): Promise<void> {
  if (update.callback_query) {
    await handleCallback(update.callback_query);
    return;
  }

  const msg = update.message;
  if (!msg || typeof msg.text !== "string") return;
  const text = msg.text.trim();
  const chatId = msg.chat.id;
  const inGroup =
    msg.chat.type === "group" || msg.chat.type === "supergroup";

  if (text.startsWith("/")) {
    const [cmdRaw, ...rest] = text.split(/\s+/);
    const cmd = cmdRaw.split("@")[0].toLowerCase(); // /report@Bot -> /report
    const arg = rest.join(" ").trim();

    // /here работает в группе; остальные команды в группе игнорируем,
    // чтобы бот не флудил в общий чат.
    if (cmd === "/here") {
      await handleHere(msg);
      return;
    }
    if (inGroup) return;

    switch (cmd) {
      case "/start":
        await handleStart(msg, arg);
        return;
      case "/report":
        await handleReport(chatId);
        return;
      case "/status":
        await handleStatus(chatId);
        return;
      case "/cancel":
        await handleCancel(chatId);
        return;
      case "/done":
        await handleDoneCommand(chatId);
        return;
      case "/help":
        await sendMessage(chatId, HELP);
        return;
      default:
        await sendMessage(chatId, `Неизвестная команда.\n\n${HELP}`);
        return;
    }
  }

  // Произвольный текст обрабатываем только в личке (в группе не мешаем).
  if (inGroup) return;
  await handleText(chatId, text);
}

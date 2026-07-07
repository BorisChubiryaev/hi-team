// Логика Telegram-бота: привязка аккаунта, приём отчёта свободным текстом
// (AI-разбор + подтверждение кнопкой), статус недели. Состояние диалога
// хранится в БД (TelegramDialog), т.к. serverless без общей памяти.

import { prisma } from "@/lib/db";
import { parseReportText, type ParsedProject } from "@/lib/openrouter";
import { saveUserReport } from "@/lib/reports";
import {
  answerCallbackQuery,
  editMessageText,
  sendMessage,
} from "@/lib/telegram";
import { currentWeekRange, formatWeekLabel, isoDate } from "@/lib/weeks";

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
  "/report — отправить недельный отчёт (просто опишите неделю одним сообщением, я структурирую)",
  "/status — сдан ли мой отчёт за текущую неделю",
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

function previewText(projects: ParsedProject[], weekLabel: string): string {
  const lines = [`Ваш отчёт за неделю ${weekLabel}:`, ""];
  projects.forEach((p, i) => {
    lines.push(`${i + 1}. ${p.name}`);
    if (p.done) lines.push(`   Сделано: ${p.done}`);
    if (p.blockers) lines.push(`   Блокеры: ${p.blockers}`);
    if (p.plans) lines.push(`   Планы: ${p.plans}`);
  });
  lines.push("", "Сохранить?");
  return lines.join("\n");
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

async function handleReport(chatId: number) {
  const user = await linkedUser(chatId);
  if (!user) {
    await sendMessage(
      chatId,
      `Сначала привяжите аккаунт в «Настройках»: ${appUrl()}/settings`,
    );
    return;
  }
  const { start, end } = currentWeekRange();
  await setDialog(chatId, "awaiting_report", { weekStartIso: isoDate(start) });
  await sendMessage(
    chatId,
    `Опишите одним сообщением, что сделали за неделю ${formatWeekLabel(
      start,
      end,
    )}, какие блокеры и планы. Я структурирую по проектам и покажу на подтверждение.`,
  );
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
  const dialog = await prisma.telegramDialog.findUnique({
    where: { chatId: String(chatId) },
  });

  if (dialog?.state === "awaiting_report") {
    const user = await linkedUser(chatId);
    if (!user) {
      await clearDialog(chatId);
      await sendMessage(chatId, `Аккаунт не привязан: ${appUrl()}/settings`);
      return;
    }
    await sendMessage(chatId, "Разбираю отчёт…");
    const projects = await parseReportText(text);
    const weekStartIso = dialog.weekStartIso ?? isoDate(currentWeekRange().start);
    const target = currentWeekRange();
    await setDialog(chatId, "confirming", {
      weekStartIso,
      draft: JSON.stringify(projects),
    });
    await sendMessage(
      chatId,
      previewText(projects, formatWeekLabel(target.start, target.end)),
      [
        [
          { text: "✅ Сохранить", callback_data: "save" },
          { text: "✖️ Отмена", callback_data: "cancel" },
        ],
      ],
    );
    return;
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

  const dialog = await prisma.telegramDialog.findUnique({
    where: { chatId: String(chatId) },
  });

  if (cb.data === "cancel") {
    await clearDialog(chatId);
    await answerCallbackQuery(cb.id, "Отменено");
    await editMessageText(chatId, messageId, "Отчёт отменён. Отправить заново — /report.");
    return;
  }

  if (cb.data === "save") {
    const user = await linkedUser(chatId);
    if (!user || dialog?.state !== "confirming" || !dialog.draft) {
      await answerCallbackQuery(cb.id, "Нечего сохранять");
      await editMessageText(chatId, messageId, "Черновик не найден. Отправить заново — /report.");
      return;
    }
    try {
      const projects = JSON.parse(dialog.draft) as ParsedProject[];
      const weekStartIso =
        dialog.weekStartIso ?? isoDate(currentWeekRange().start);
      const count = await saveUserReport(user.id, weekStartIso, projects);
      await clearDialog(chatId);
      await answerCallbackQuery(cb.id, "Сохранено");
      await editMessageText(
        chatId,
        messageId,
        `Отчёт сохранён (${count} проект(ов)). Спасибо!`,
      );
    } catch (e) {
      console.error("bot save:", e instanceof Error ? e.message : e);
      await answerCallbackQuery(cb.id, "Ошибка");
      await editMessageText(
        chatId,
        messageId,
        "Не удалось сохранить отчёт. Попробуйте позже или заполните на сайте.",
      );
    }
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

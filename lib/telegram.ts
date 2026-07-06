// Тонкий клиент Telegram Bot API. Токен — только из серверного окружения.
// Сообщения шлём без parse_mode (обычный текст), чтобы не мучиться с
// экранированием Markdown/HTML для пользовательского контента.

const API = "https://api.telegram.org";

function token(): string | null {
  return process.env.TELEGRAM_BOT_TOKEN || null;
}

export type InlineButton = { text: string; callback_data: string };

async function call<T = unknown>(
  method: string,
  body: Record<string, unknown>,
): Promise<T | null> {
  const t = token();
  if (!t) {
    console.error("TELEGRAM_BOT_TOKEN не задан");
    return null;
  }
  const res = await fetch(`${API}/bot${t}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    console.error(`Telegram ${method}: ${res.status} ${await res.text()}`);
    return null;
  }
  const data = await res.json();
  return data.result as T;
}

export async function sendMessage(
  chatId: string | number,
  text: string,
  buttons?: InlineButton[][],
): Promise<boolean> {
  const body: Record<string, unknown> = {
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
  };
  if (buttons) body.reply_markup = { inline_keyboard: buttons };
  return (await call("sendMessage", body)) !== null;
}

export async function editMessageText(
  chatId: string | number,
  messageId: number,
  text: string,
): Promise<boolean> {
  return (
    (await call("editMessageText", {
      chat_id: chatId,
      message_id: messageId,
      text,
      reply_markup: { inline_keyboard: [] },
    })) !== null
  );
}

export async function answerCallbackQuery(
  callbackQueryId: string,
  text?: string,
): Promise<void> {
  await call("answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    ...(text ? { text } : {}),
  });
}

/** Регистрирует webhook и секрет проверки (см. /api/telegram/webhook). */
export async function setWebhook(
  url: string,
  secret: string,
): Promise<unknown> {
  return call("setWebhook", {
    url,
    secret_token: secret,
    allowed_updates: ["message", "callback_query"],
  });
}

export async function setMyCommands(): Promise<unknown> {
  return call("setMyCommands", {
    commands: [
      { command: "report", description: "Отправить недельный отчёт" },
      { command: "status", description: "Мой статус за неделю" },
      { command: "help", description: "Помощь" },
    ],
  });
}

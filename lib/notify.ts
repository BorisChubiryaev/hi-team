// Уведомления команде: Telegram-бот и/или произвольный webhook.
// Настраивается через env; если ничего не настроено — уведомления
// просто не отправляются (cron при этом отработает штатно).

import { sendMessage } from "@/lib/telegram";

type Channel = "telegram" | "webhook";

/** Шлёт сообщение в конкретный Telegram-чат. true = отправлено. */
export async function sendTelegram(
  chatId: string,
  text: string,
): Promise<boolean> {
  if (!chatId) return false;
  return sendMessage(chatId, text);
}

/**
 * Шлёт текст во все настроенные общие каналы.
 * Возвращает список каналов, куда реально отправили.
 */
export async function notifyTeam(text: string): Promise<Channel[]> {
  const sent: Channel[] = [];

  const tgChatId = process.env.TELEGRAM_CHAT_ID;
  if (tgChatId && (await sendTelegram(tgChatId, text))) {
    sent.push("telegram");
  }

  // Универсальный webhook: POST {"text": "..."} — формат понимает Slack,
  // Mattermost и большинство чат-интеграций.
  const webhookUrl = process.env.NOTIFY_WEBHOOK_URL;
  if (webhookUrl) {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) {
      console.error(`Notify webhook: ${res.status} ${await res.text()}`);
    } else {
      sent.push("webhook");
    }
  }

  return sent;
}

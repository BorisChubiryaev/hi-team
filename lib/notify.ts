// Уведомления команде: Telegram-бот и/или произвольный webhook.
// Настраивается через env; если ничего не настроено — уведомления
// просто не отправляются (cron при этом отработает штатно).

type Channel = "telegram" | "webhook";

/**
 * Шлёт текст во все настроенные каналы.
 * Возвращает список каналов, куда реально отправили.
 */
export async function notifyTeam(text: string): Promise<Channel[]> {
  const sent: Channel[] = [];

  const tgToken = process.env.TELEGRAM_BOT_TOKEN;
  const tgChatId = process.env.TELEGRAM_CHAT_ID;
  if (tgToken && tgChatId) {
    const res = await fetch(
      `https://api.telegram.org/bot${tgToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: tgChatId, text }),
      },
    );
    if (!res.ok) {
      console.error(`Telegram sendMessage: ${res.status} ${await res.text()}`);
    } else {
      sent.push("telegram");
    }
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

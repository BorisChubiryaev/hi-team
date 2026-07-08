"use server";

import { requireDbUser } from "@/lib/auth";
import { writesReports } from "@/lib/roles";
import { sendMessage } from "@/lib/telegram";

export type SendResult = { ok: true } | { ok: false; error: string };

const TG_LIMIT = 3900; // с запасом под лимит Telegram (4096)
const MAX_CONTENT = 20000;

/** Режет текст на части ≤ TG_LIMIT, предпочитая границы абзацев/строк. */
function chunk(text: string): string[] {
  const parts: string[] = [];
  let rest = text.trim();
  while (rest.length > TG_LIMIT) {
    let cut = rest.lastIndexOf("\n", TG_LIMIT);
    if (cut < TG_LIMIT * 0.5) cut = TG_LIMIT; // нет удобного переноса — режем жёстко
    parts.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trimStart();
  }
  if (rest) parts.push(rest);
  return parts;
}

/** Отправляет материалы подготовки в личный Telegram текущего пользователя. */
export async function sendReviewToTelegram(
  label: string,
  content: string,
): Promise<SendResult> {
  const user = await requireDbUser();
  if (!writesReports(user.role)) {
    return { ok: false, error: "Недоступно для вашей роли" };
  }
  if (!content.trim()) {
    return { ok: false, error: "Нет материалов для отправки" };
  }
  if (!user.telegramChatId) {
    return { ok: false, error: "Сначала подключите Telegram в «Настройках»" };
  }

  const header = `📋 Подготовка к встрече — ${label}`;
  if (!(await sendMessage(user.telegramChatId, header))) {
    return {
      ok: false,
      error: "Не удалось отправить — проверьте, что бот не заблокирован.",
    };
  }
  for (const part of chunk(content.slice(0, MAX_CONTENT))) {
    if (!(await sendMessage(user.telegramChatId, part))) {
      return { ok: false, error: "Отправлено частично — попробуйте ещё раз." };
    }
  }
  return { ok: true };
}

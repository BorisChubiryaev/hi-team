"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireDbUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

const CODE_TTL_MIN = 15;

/** Генерирует одноразовый код привязки Telegram и возвращает deep-link на бота. */
export async function createTelegramLink(): Promise<
  { ok: true; url: string; code: string } | { ok: false; error: string }
> {
  const user = await requireDbUser();
  const botUsername = process.env.TELEGRAM_BOT_USERNAME;
  if (!botUsername) {
    return { ok: false, error: "Бот не настроен (TELEGRAM_BOT_USERNAME)" };
  }

  const code = randomBytes(9).toString("base64url");
  const expiresAt = new Date(Date.now() + CODE_TTL_MIN * 60_000);

  await prisma.telegramLink.upsert({
    where: { userId: user.id },
    update: { code, expiresAt },
    create: { userId: user.id, code, expiresAt },
  });

  revalidatePath("/settings");
  return { ok: true, url: `https://t.me/${botUsername}?start=${code}`, code };
}

/** Отвязывает Telegram от текущего аккаунта. */
export async function unlinkTelegram() {
  const user = await requireDbUser();
  await prisma.user.update({
    where: { id: user.id },
    data: { telegramChatId: null, telegramUsername: null },
  });
  await prisma.telegramLink.deleteMany({ where: { userId: user.id } });
  revalidatePath("/settings");
}

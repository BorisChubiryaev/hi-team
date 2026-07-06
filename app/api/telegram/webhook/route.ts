// Webhook Telegram. Проверяем секрет из заголовка (задаётся при setWebhook),
// затем обрабатываем апдейт. Всегда отвечаем 200, чтобы Telegram не долбил
// ретраями — ошибки логируем.

import { NextResponse } from "next/server";
import { handleUpdate, type Update } from "@/lib/bot";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (
    !secret ||
    req.headers.get("x-telegram-bot-api-secret-token") !== secret
  ) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  try {
    const update = (await req.json()) as Update;
    await handleUpdate(update);
  } catch (e) {
    console.error("telegram webhook:", e instanceof Error ? e.message : e);
  }
  return NextResponse.json({ ok: true });
}

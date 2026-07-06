// Разовая настройка бота: регистрирует webhook (с секретом) и команды меню.
// Защищено CRON_SECRET. Вызвать после деплоя:
//   curl -H "Authorization: Bearer $CRON_SECRET" https://<app>/api/telegram/setup

import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cron";
import { setMyCommands, setWebhook } from "@/lib/telegram";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const appUrl = process.env.APP_URL;
  if (!secret || !appUrl) {
    return NextResponse.json(
      { error: "Нужны TELEGRAM_WEBHOOK_SECRET и APP_URL" },
      { status: 400 },
    );
  }

  const webhook = await setWebhook(`${appUrl}/api/telegram/webhook`, secret);
  const commands = await setMyCommands();

  return NextResponse.json({ webhook, commands });
}

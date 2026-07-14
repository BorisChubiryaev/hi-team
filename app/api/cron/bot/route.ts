// Почасовой крон бота: смотрит настройки (BotSettings) и в нужный день недели,
// начиная с назначенного часа, шлёт личные напоминания и/или групповой ростер.
// Пингуется каждый час из GitHub Actions (.github/workflows/bot-cron.yml) —
// бесплатная замена почасовому крону Vercel (на Hobby крон можно раз в сутки).
//
// Условие часа — «>= назначенного», а не «== назначенному»: запуски GitHub
// Actions часто задерживаются, и точный час можно проскочить. С «>=» сработает
// на первом пинге после нужного часа, а дедуп по локальной дате гарантирует
// один раз в день. Ручной прогон сейчас: ?force=reminder|group.

import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cron";
import { prisma } from "@/lib/db";
import { localParts } from "@/lib/localtime";
import { sendGroupRoster, sendReminders } from "@/lib/reminders";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const settings = await prisma.botSettings.findUnique({
    where: { id: "singleton" },
  });
  if (!settings) {
    return NextResponse.json({ ran: [], note: "Настройки бота не заданы" });
  }

  const force = new URL(req.url).searchParams.get("force");
  const { dow, hour, dateKey } = localParts(settings.timezone);
  const ran: Record<string, unknown> = {};

  const reminderDue =
    settings.reminderEnabled &&
    dow === settings.reminderDow &&
    hour >= settings.reminderHour &&
    settings.lastReminderKey !== dateKey;

  if (force === "reminder" || reminderDue) {
    ran.reminder = await sendReminders();
    if (reminderDue) {
      await prisma.botSettings.update({
        where: { id: "singleton" },
        data: { lastReminderKey: dateKey },
      });
    }
  }

  const groupDue =
    settings.groupEnabled &&
    !!settings.groupChatId &&
    dow === settings.groupDow &&
    hour >= settings.groupHour &&
    settings.lastGroupKey !== dateKey;

  if ((force === "group" || groupDue) && settings.groupChatId) {
    ran.group = await sendGroupRoster(settings.groupChatId);
    if (groupDue) {
      await prisma.botSettings.update({
        where: { id: "singleton" },
        data: { lastGroupKey: dateKey },
      });
    }
  }

  return NextResponse.json({ localTime: { dow, hour, dateKey }, ran });
}

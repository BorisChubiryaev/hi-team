// Почасовой крон бота: смотрит настройки (BotSettings) и, если по локальному
// времени команды наступил назначенный час/день, шлёт личные напоминания и/или
// групповой ростер. Идемпотентен: дедуп по локальной дате (не сработает дважды
// в один день). Также поддерживает ручной прогон ?force=reminder|group.

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
    hour === settings.reminderHour &&
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
    hour === settings.groupHour &&
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

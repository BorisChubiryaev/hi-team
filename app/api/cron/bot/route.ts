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
  // Понятная причина в ответе — чтобы по логу сразу было видно, почему
  // рассылка не ушла (день/час/дедуп), а не гадать по пустому ran.
  const status: Record<string, string> = {};

  // Причина «не сработало» для запланированной рассылки (день + час + дедуп).
  function reason(
    enabled: boolean,
    day: number,
    startHour: number,
    lastKey: string | null,
  ): string | null {
    if (!enabled) return "выключено";
    if (dow !== day) return `не сегодня (нужен день ${day}, сейчас ${dow})`;
    if (hour < startHour) return `рано (нужно с ${startHour}:00, сейчас ${hour}:00)`;
    if (lastKey === dateKey) return "уже отправлено сегодня";
    return null; // null = пора слать
  }

  const reminderReason = reason(
    settings.reminderEnabled,
    settings.reminderDow,
    settings.reminderHour,
    settings.lastReminderKey,
  );
  const reminderDue = reminderReason === null;

  if (force === "reminder" || reminderDue) {
    ran.reminder = await sendReminders();
    status.reminder = force === "reminder" ? "отправлено (force)" : "отправлено";
    if (reminderDue) {
      await prisma.botSettings.update({
        where: { id: "singleton" },
        data: { lastReminderKey: dateKey },
      });
    }
  } else {
    status.reminder = reminderReason;
  }

  const groupReason = !settings.groupChatId
    ? "чат не подключён"
    : reason(
        settings.groupEnabled,
        settings.groupDow,
        settings.groupHour,
        settings.lastGroupKey,
      );
  const groupDue = groupReason === null;

  if ((force === "group" || groupDue) && settings.groupChatId) {
    ran.group = await sendGroupRoster(settings.groupChatId);
    status.group = force === "group" ? "отправлено (force)" : "отправлено";
    if (groupDue) {
      await prisma.botSettings.update({
        where: { id: "singleton" },
        data: { lastGroupKey: dateKey },
      });
    }
  } else {
    status.group = groupReason ?? "не отправлено";
  }

  return NextResponse.json({ localTime: { dow, hour, dateKey }, status, ran });
}

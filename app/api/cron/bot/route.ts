// Почасовой крон бота: по КАЖДОЙ команде смотрит её настройки (BotSettings)
// и в нужный день недели, начиная с назначенного часа, шлёт личные напоминания
// и/или групповой ростер. Пингуется каждый час из GitHub Actions
// (.github/workflows/bot-cron.yml) — бесплатная замена почасовому крону Vercel
// (на Hobby крон можно раз в сутки).
//
// Условие часа — «>= назначенного», а не «== назначенному»: запуски GitHub
// Actions часто задерживаются, и точный час можно проскочить. С «>=» сработает
// на первом пинге после нужного часа, а дедуп по локальной дате гарантирует
// один раз в день. Ручной прогон сейчас: ?force=reminder|group.

import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cron";
import { prisma } from "@/lib/db";
import { localParts, type LocalParts } from "@/lib/localtime";
import { sendGroupRoster, sendReminders } from "@/lib/reminders";

export const dynamic = "force-dynamic";

/** Причина «не сработало» для запланированной рассылки (день + час + дедуп). */
function reason(
  now: LocalParts,
  enabled: boolean,
  day: number,
  startHour: number,
  lastKey: string | null,
): string | null {
  if (!enabled) return "выключено";
  if (now.dow !== day) return `не сегодня (нужен день ${day}, сейчас ${now.dow})`;
  if (now.hour < startHour)
    return `рано (нужно с ${startHour}:00, сейчас ${now.hour}:00)`;
  if (lastKey === now.dateKey) return "уже отправлено сегодня";
  return null; // null = пора слать
}

export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const force = new URL(req.url).searchParams.get("force");
  const allSettings = await prisma.botSettings.findMany();
  if (allSettings.length === 0) {
    return NextResponse.json({ workspaces: [], note: "Настройки бота не заданы" });
  }

  const results: Record<string, unknown>[] = [];

  for (const settings of allSettings) {
    const now = localParts(settings.timezone);
    const wsId = settings.workspaceId;
    const ran: Record<string, unknown> = {};
    const status: Record<string, string> = {};

    // Личные напоминания.
    const reminderReason = reason(
      now,
      settings.reminderEnabled,
      settings.reminderDow,
      settings.reminderHour,
      settings.lastReminderKey,
    );
    if (force === "reminder" || reminderReason === null) {
      ran.reminder = await sendReminders(wsId);
      status.reminder = force === "reminder" ? "отправлено (force)" : "отправлено";
      if (reminderReason === null) {
        await prisma.botSettings.update({
          where: { id: settings.id },
          data: { lastReminderKey: now.dateKey },
        });
      }
    } else {
      status.reminder = reminderReason;
    }

    // Групповой ростер.
    const groupReason = !settings.groupChatId
      ? "чат не подключён"
      : reason(
          now,
          settings.groupEnabled,
          settings.groupDow,
          settings.groupHour,
          settings.lastGroupKey,
        );
    if ((force === "group" || groupReason === null) && settings.groupChatId) {
      ran.group = await sendGroupRoster(settings.groupChatId, wsId);
      status.group = force === "group" ? "отправлено (force)" : "отправлено";
      if (groupReason === null) {
        await prisma.botSettings.update({
          where: { id: settings.id },
          data: { lastGroupKey: now.dateKey },
        });
      }
    } else {
      status.group = groupReason ?? "не отправлено";
    }

    results.push({
      workspaceId: wsId,
      localTime: now,
      status,
      ran,
    });
  }

  return NextResponse.json({ workspaces: results });
}

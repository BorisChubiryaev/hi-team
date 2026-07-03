// Cron (четверг): напоминает тем, кто ещё не заполнил отчёт за текущую
// неделю, — лично в Telegram (если задан chat_id) и общим сообщением.

import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cron";
import { prisma } from "@/lib/db";
import { notifyTeam, sendTelegram } from "@/lib/notify";
import { currentWeekRange, formatWeekLabel } from "@/lib/weeks";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const { start, end } = currentWeekRange();
  const label = formatWeekLabel(start, end);

  const [users, week] = await Promise.all([
    prisma.user.findMany({
      where: { active: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.week.findUnique({
      where: { startDate: start },
      include: { reports: { include: { projects: true } } },
    }),
  ]);

  const submitted = new Set(
    (week?.reports ?? [])
      .filter((r) => r.projects.length > 0)
      .map((r) => r.userId),
  );
  const missing = users.filter((u) => !submitted.has(u.id));

  if (missing.length === 0) {
    return NextResponse.json({ week: label, missing: [], notified: [] });
  }

  const appUrl = process.env.APP_URL || "http://localhost:3000";

  // Личные напоминания тем, у кого настроен Telegram.
  let personal = 0;
  for (const u of missing) {
    if (!u.telegramChatId) continue;
    const ok = await sendTelegram(
      u.telegramChatId,
      `⏰ ${u.name ?? "Привет"}, не забудьте заполнить отчёт за неделю ${label}: ${appUrl}/report`,
    );
    if (ok) personal++;
  }

  // Общее сообщение в командный канал.
  const names = missing.map((u) => u.name ?? u.email).join(", ");
  const notified = await notifyTeam(
    `⏰ Напоминание: не заполнен отчёт за неделю ${label}.\n` +
      `Ждём: ${names}.\n` +
      `Заполнить: ${appUrl}/report`,
  );

  return NextResponse.json({
    week: label,
    missing: missing.map((u) => u.email),
    personal,
    notified,
  });
}

// Cron (четверг): напоминает тем, кто ещё не заполнил отчёт за текущую неделю.

import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cron";
import { prisma } from "@/lib/db";
import { notifyTeam } from "@/lib/notify";
import { currentWeekRange, formatWeekLabel } from "@/lib/weeks";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const { start, end } = currentWeekRange();
  const label = formatWeekLabel(start, end);

  const [users, week] = await Promise.all([
    prisma.user.findMany({ orderBy: { createdAt: "asc" } }),
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

  const names = missing.map((u) => u.name ?? u.email).join(", ");
  const appUrl = process.env.APP_URL || "http://localhost:3000";
  const text =
    `⏰ Напоминание: не заполнен отчёт за неделю ${label}.\n` +
    `Ждём: ${names}.\n` +
    `Заполнить: ${appUrl}/report`;

  const notified = await notifyTeam(text);

  return NextResponse.json({
    week: label,
    missing: missing.map((u) => u.email),
    notified,
  });
}

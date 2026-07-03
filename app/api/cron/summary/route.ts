// Cron (пятница вечером): генерирует AI-сводку текущей недели
// и уведомляет команду. Перегенерирует, даже если сводка уже была, —
// к вечеру пятницы отчёты могли обновиться.

import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cron";
import { prisma } from "@/lib/db";
import { notifyTeam } from "@/lib/notify";
import { generateWeekSummary } from "@/lib/summary";
import { currentWeekRange, formatWeekLabel } from "@/lib/weeks";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const { start, end } = currentWeekRange();
  const label = formatWeekLabel(start, end);

  const week = await prisma.week.findUnique({ where: { startDate: start } });
  if (!week) {
    return NextResponse.json({ week: label, skipped: "Неделя ещё не создана" });
  }

  const result = await generateWeekSummary(week.id);
  if (!result.ok) {
    // «Нет отчётов» — штатная ситуация для cron, не ошибка.
    if (result.status === 400) {
      return NextResponse.json({ week: label, skipped: result.error });
    }
    return NextResponse.json(
      { week: label, error: result.error },
      { status: result.status },
    );
  }

  const appUrl = process.env.APP_URL || "http://localhost:3000";
  const notified = await notifyTeam(
    `📋 AI-сводка за неделю ${label} готова: ${appUrl}/dashboard`,
  );

  return NextResponse.json({ week: label, model: result.model, notified });
}

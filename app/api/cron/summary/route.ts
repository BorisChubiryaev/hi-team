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

  // Генерируем сводку для каждой команды по её отчётам.
  const workspaces = await prisma.workspace.findMany({ select: { id: true } });
  const results: Record<string, unknown>[] = [];
  for (const ws of workspaces) {
    const r = await generateWeekSummary(week.id, ws.id);
    results.push(
      r.ok
        ? { workspace: ws.id, model: r.model }
        : { workspace: ws.id, skipped: r.error },
    );
  }

  const appUrl = process.env.APP_URL || "http://localhost:3000";
  // Уведомления пока общие (env-канал); per-workspace — Фаза 4.
  const notified = await notifyTeam(
    `📋 AI-сводка за неделю ${label} готова: ${appUrl}/dashboard`,
  );

  return NextResponse.json({ week: label, workspaces: results, notified });
}

// Генерация AI-сводки недели: общий код для /api/summary (по кнопке)
// и /api/cron/summary (по расписанию). Подмешивает блокеры прошлых
// двух недель, чтобы сводка отмечала «висящие» блокеры.

import { prisma } from "@/lib/db";
import { summarizeWeek } from "@/lib/openrouter";

export type WeekSummaryResult =
  | { ok: true; content: string; model: string }
  | { ok: false; status: number; error: string };

const PREVIOUS_WEEKS_FOR_CONTEXT = 2;

export async function generateWeekSummary(
  weekId: string,
): Promise<WeekSummaryResult> {
  const week = await prisma.week.findUnique({
    where: { id: weekId },
    include: {
      reports: {
        include: {
          user: true,
          projects: { orderBy: { order: "asc" } },
        },
      },
    },
  });

  if (!week) {
    return { ok: false, status: 404, error: "Неделя не найдена" };
  }
  if (week.reports.length === 0) {
    return { ok: false, status: 400, error: "За эту неделю нет отчётов" };
  }

  // Блокеры прошлых недель — контекст для пометки повторяющихся.
  const previousWeeks = await prisma.week.findMany({
    where: { startDate: { lt: week.startDate } },
    orderBy: { startDate: "desc" },
    take: PREVIOUS_WEEKS_FOR_CONTEXT,
    include: {
      reports: {
        include: {
          user: true,
          projects: { where: { NOT: { blockers: "" } } },
        },
      },
    },
  });

  const previousBlockers = previousWeeks.flatMap((w) =>
    w.reports.flatMap((r) =>
      r.projects.map((p) => ({
        weekLabel: w.label,
        userName: r.user.name ?? r.user.email,
        projectName: p.name,
        blockers: p.blockers,
      })),
    ),
  );

  try {
    const { content, model } = await summarizeWeek({
      weekLabel: week.label,
      reports: week.reports.map((r) => ({
        name: r.user.name ?? r.user.email,
        projects: r.projects,
      })),
      previousBlockers,
    });

    await prisma.summary.upsert({
      where: { weekId },
      update: { content, model },
      create: { weekId, content, model },
    });

    return { ok: true, content, model };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Ошибка генерации";
    return { ok: false, status: 502, error: message };
  }
}

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
  workspaceId: string | null,
): Promise<WeekSummaryResult> {
  const week = await prisma.week.findUnique({
    where: { id: weekId },
    include: {
      reports: {
        where: { workspaceId },
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
        where: { workspaceId },
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

  // Системный промпт команды (если задан) вместо дефолтного.
  const ws = workspaceId
    ? await prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { weekPrompt: true },
      })
    : null;

  try {
    const { content, model } = await summarizeWeek(
      {
        weekLabel: week.label,
        reports: week.reports.map((r) => ({
          name: r.user.name ?? r.user.email,
          subteam: r.user.subteam,
          projects: r.projects,
        })),
        previousBlockers,
      },
      ws?.weekPrompt,
    );

    // Одна сводка на (неделя, команда). workspaceId nullable — используем
    // find + update/create вместо upsert по составному ключу.
    const existing = await prisma.summary.findFirst({
      where: { weekId, workspaceId },
      select: { id: true },
    });
    if (existing) {
      await prisma.summary.update({
        where: { id: existing.id },
        data: { content, model },
      });
    } else {
      await prisma.summary.create({
        data: { weekId, content, model, workspaceId },
      });
    }

    return { ok: true, content, model };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Ошибка генерации";
    return { ok: false, status: 502, error: message };
  }
}

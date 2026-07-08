// Сбор данных сотрудника за период и генерация личной подготовки к встрече.

import { prisma } from "@/lib/db";
import { writeReviewPrep, type ReviewInput } from "@/lib/openrouter";

export type ReviewStats = {
  weeksTotal: number; // недель с отчётами команды в периоде
  weeksReported: number; // из них сдал сам сотрудник
  projects: number;
  doneEntries: number;
  blockers: number;
};

export type ReviewData = {
  stats: ReviewStats;
  projects: ReviewInput["projects"];
  hasData: boolean;
};

/** Собирает отчёты сотрудника за период, сгруппированные по проектам, + факты. */
export async function getReviewData(
  userId: string,
  start: Date,
  end: Date,
): Promise<ReviewData> {
  const weeks = await prisma.week.findMany({
    where: { startDate: { gte: start, lte: end } },
    orderBy: { startDate: "asc" },
    include: {
      reports: {
        where: { userId },
        include: { projects: { orderBy: { order: "asc" } } },
      },
    },
  });

  // Группируем строки отчётов по имени проекта, сохраняя порядок недель.
  const byProject = new Map<string, ReviewInput["projects"][number]>();
  let doneEntries = 0;
  let blockers = 0;
  let weeksReported = 0;

  for (const w of weeks) {
    const report = w.reports[0];
    if (!report || report.projects.length === 0) continue;
    weeksReported++;
    for (const p of report.projects) {
      if (p.done.trim()) doneEntries++;
      if (p.blockers.trim()) blockers++;
      const key = p.name.trim() || "Общее";
      const group = byProject.get(key) ?? { name: key, weeks: [] };
      group.weeks.push({
        weekLabel: w.label,
        done: p.done,
        blockers: p.blockers,
        plans: p.plans,
      });
      byProject.set(key, group);
    }
  }

  const projects = [...byProject.values()];
  return {
    stats: {
      weeksTotal: weeks.length,
      weeksReported,
      projects: projects.length,
      doneEntries,
      blockers,
    },
    projects,
    hasData: projects.length > 0,
  };
}

/**
 * Генерирует и сохраняет подготовку к встрече за период. Возвращает контент.
 * Бросает, если за период у сотрудника нет отчётов.
 */
export async function generateAndSaveReviewPrep(params: {
  userId: string;
  userName: string;
  start: Date;
  end: Date;
  label: string;
  focus: string;
}): Promise<{ content: string; model: string }> {
  const { userId, userName, start, end, label, focus } = params;
  const data = await getReviewData(userId, start, end);
  if (!data.hasData) {
    throw new Error("За этот период у вас нет отчётов");
  }

  const { content, model } = await writeReviewPrep({
    periodLabel: label,
    userName,
    focus: focus || undefined,
    stats: {
      weeksReported: data.stats.weeksReported,
      weeksTotal: data.stats.weeksTotal,
      projects: data.stats.projects,
      blockers: data.stats.blockers,
    },
    projects: data.projects,
  });

  await prisma.reviewPrep.upsert({
    where: {
      userId_periodStart_periodEnd: {
        userId,
        periodStart: start,
        periodEnd: end,
      },
    },
    update: { label, focus: focus || null, content, model },
    create: {
      userId,
      periodStart: start,
      periodEnd: end,
      label,
      focus: focus || null,
      content,
      model,
    },
  });

  return { content, model };
}

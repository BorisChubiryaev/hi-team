// Сбор данных для страницы аналитики: дисциплина сдачи, динамика блокеров,
// топ проектов и активность «проект × неделя».

import { prisma } from "@/lib/db";
import { currentWeekRange, isoDate } from "@/lib/weeks";

export type WeekPoint = { label: string; value: number };

export type Analytics = {
  tiles: {
    activeProjects: number;
    pausedProjects: number;
    doneProjects: number;
    submittedThisWeek: number;
    teamSize: number;
    blockersLastWeek: number;
    totalWeeks: number;
  };
  /** Сдано отчётов по неделям (от старых к новым). */
  discipline: WeekPoint[];
  teamSize: number;
  /** Строк с непустыми блокерами по неделям (от старых к новым). */
  blockers: WeekPoint[];
  /** Топ проектов по числу упоминаний за период. */
  topProjects: { id: string; name: string; mentions: number }[];
  /** Активность: сколько человек упоминали проект в каждую неделю периода. */
  heatmap: {
    weekLabels: string[];
    rows: { id: string; name: string; cells: number[] }[];
  };
};

const TOP_PROJECTS = 8;
const HEATMAP_ROWS = 10;

/** @param weeksLimit сколько последних недель включать; 0 = все. */
export async function getAnalytics(weeksLimit: number): Promise<Analytics> {
  const { start: currentStart } = currentWeekRange();

  const [weeks, projectCounts, users] = await Promise.all([
    prisma.week.findMany({
      orderBy: { startDate: "desc" },
      ...(weeksLimit > 0 ? { take: weeksLimit } : {}),
      include: {
        reports: {
          include: {
            projects: {
              select: { projectId: true, name: true, blockers: true },
            },
          },
        },
      },
    }),
    prisma.project.groupBy({ by: ["status"], _count: true }),
    prisma.user.findMany({
      where: { active: true },
      select: { id: true },
    }),
  ]);

  const chrono = [...weeks].reverse(); // от старых к новым
  const teamSize = users.length;

  const discipline: WeekPoint[] = chrono.map((w) => ({
    label: w.label,
    value: w.reports.filter((r) => r.projects.length > 0).length,
  }));

  const blockers: WeekPoint[] = chrono.map((w) => ({
    label: w.label,
    value: w.reports.reduce(
      (acc, r) => acc + r.projects.filter((p) => p.blockers.trim()).length,
      0,
    ),
  }));

  // Упоминания проектов за период: projectId -> {name, mentions, perWeek}
  const mentions = new Map<
    string,
    { name: string; total: number; perWeek: Map<string, number> }
  >();
  for (const w of chrono) {
    const weekKey = isoDate(w.startDate);
    for (const r of w.reports) {
      for (const p of r.projects) {
        if (!p.projectId) continue;
        const m =
          mentions.get(p.projectId) ??
          { name: p.name, total: 0, perWeek: new Map<string, number>() };
        m.total++;
        m.name = p.name; // последнее написание — актуальное
        m.perWeek.set(weekKey, (m.perWeek.get(weekKey) ?? 0) + 1);
        mentions.set(p.projectId, m);
      }
    }
  }
  const ranked = [...mentions.entries()].sort(
    (a, b) => b[1].total - a[1].total,
  );

  const topProjects = ranked
    .slice(0, TOP_PROJECTS)
    .map(([id, m]) => ({ id, name: m.name, mentions: m.total }));

  const heatmap = {
    weekLabels: chrono.map((w) => w.label),
    rows: ranked.slice(0, HEATMAP_ROWS).map(([id, m]) => ({
      id,
      name: m.name,
      cells: chrono.map((w) => m.perWeek.get(isoDate(w.startDate)) ?? 0),
    })),
  };

  const statusCount = (s: string) =>
    projectCounts.find((c) => c.status === s)?._count ?? 0;

  const currentWeek = weeks.find(
    (w) => w.startDate.getTime() === currentStart.getTime(),
  );
  const lastFinishedWeek = chrono.filter(
    (w) => w.startDate.getTime() < currentStart.getTime(),
  ).at(-1);

  return {
    tiles: {
      activeProjects: statusCount("ACTIVE"),
      pausedProjects: statusCount("PAUSED"),
      doneProjects: statusCount("DONE"),
      submittedThisWeek:
        currentWeek?.reports.filter((r) => r.projects.length > 0).length ?? 0,
      teamSize,
      blockersLastWeek: lastFinishedWeek
        ? lastFinishedWeek.reports.reduce(
            (acc, r) =>
              acc + r.projects.filter((p) => p.blockers.trim()).length,
            0,
          )
        : 0,
      totalWeeks: await prisma.week.count(),
    },
    discipline,
    teamSize,
    blockers,
    topProjects,
    heatmap,
  };
}

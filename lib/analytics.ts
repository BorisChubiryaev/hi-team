// Сбор данных для страницы аналитики: дисциплина сдачи, динамика блокеров,
// топ проектов и активность «проект × неделя». Поддерживает фильтры по
// сотруднику, проекту, статусу проекта и произвольному периоду.

import type { ProjectStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { subteamTag } from "@/lib/subteam";
import { currentWeekRange, isoDate } from "@/lib/weeks";

export type WeekPoint = { label: string; value: number };

export type AnalyticsFilters = {
  /** Команда (обязательный скоуп мультитенанта). */
  workspaceId: string | null;
  /** Сколько последних недель включать; 0 = все. */
  weeksLimit: number;
  /** Только отчёты этого сотрудника. */
  userId?: string;
  /** Только этот проект. */
  projectId?: string;
  /** Только проекты с этим статусом. */
  status?: ProjectStatus;
  /** Только сотрудники этой подкоманды. */
  subteamId?: string;
};

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
  /** Сдача за текущую неделю в разрезе подкоманд (AI / BI / без подкоманды). */
  subteamBreakdown: {
    key: string;
    label: string;
    size: number;
    submitted: number;
  }[];
  /** Топ проектов по числу упоминаний за период. */
  topProjects: { id: string; name: string; mentions: number }[];
  /** Активность: сколько человек упоминали проект в каждую неделю периода. */
  heatmap: {
    weekLabels: string[];
    rows: { id: string; name: string; cells: number[] }[];
  };
  /** Значения для выпадающих фильтров. */
  options: {
    users: { id: string; label: string }[];
    projects: { id: string; name: string }[];
    subteams: { id: string; key: string }[];
  };
};

const TOP_PROJECTS = 8;
const HEATMAP_ROWS = 10;

export async function getAnalytics(
  filters: AnalyticsFilters,
): Promise<Analytics> {
  const { workspaceId, weeksLimit, userId, projectId, status, subteamId } =
    filters;
  const { start: currentStart } = currentWeekRange();

  const [weeks, projectCounts, activeUsers, allProjects, subteamList] =
    await Promise.all([
    prisma.week.findMany({
      orderBy: { startDate: "desc" },
      ...(weeksLimit > 0 ? { take: weeksLimit } : {}),
      include: {
        reports: {
          where: { workspaceId },
          select: {
            userId: true,
            projects: {
              select: { projectId: true, name: true, blockers: true },
            },
          },
        },
      },
    }),
    prisma.project.groupBy({
      by: ["status"],
      where: { workspaceId },
      _count: true,
    }),
    // Дисциплина считается только по пишущим отчёты (без Руководителя).
    prisma.user.findMany({
      where: { active: true, role: { not: "DIRECTOR" }, workspaceId },
      select: { id: true, name: true, email: true, subteamId: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.project.findMany({
      where: { workspaceId },
      select: { id: true, name: true, status: true },
      orderBy: { name: "asc" },
    }),
    prisma.subteam.findMany({
      where: { workspaceId: workspaceId ?? "" },
      orderBy: { order: "asc" },
      select: { id: true, key: true },
    }),
  ]);

  // Набор допустимых projectId по фильтрам «проект» и «статус».
  // null = ограничений нет (учитываем все строки, включая непривязанные).
  let allowed: Set<string> | null = null;
  if (projectId) {
    allowed = new Set([projectId]);
  } else if (status) {
    allowed = new Set(
      allProjects.filter((p) => p.status === status).map((p) => p.id),
    );
  }

  // Подкоманда каждого активного сотрудника (для фильтра и разбивки).
  const subteamByUser = new Map<string, string | null>(
    activeUsers.map((u) => [u.id, u.subteamId]),
  );
  const activeIds = new Set(activeUsers.map((u) => u.id));

  type Row = { projectId: string | null; name: string; blockers: string };
  // Строки отчётов недели после применения фильтров (сотрудник + проект/статус
  // + подкоманда), сгруппированные по отчётам (для подсчёта «сдавших»).
  const filteredWeek = (w: (typeof weeks)[number]) => {
    const reports = w.reports
      .filter((r) => !userId || r.userId === userId)
      .filter((r) => !subteamId || subteamByUser.get(r.userId) === subteamId)
      .map((r) => ({
        userId: r.userId,
        projects: r.projects.filter((p) => {
          if (!allowed) return true;
          return p.projectId != null && allowed.has(p.projectId);
        }) as Row[],
      }));
    return reports;
  };

  const chrono = [...weeks].reverse(); // от старых к новым
  const teamSize = userId
    ? 1
    : subteamId
      ? activeUsers.filter((u) => u.subteamId === subteamId).length
      : activeUsers.length;

  const discipline: WeekPoint[] = chrono.map((w) => ({
    label: w.label,
    value: filteredWeek(w).filter((r) => r.projects.length > 0).length,
  }));

  const blockers: WeekPoint[] = chrono.map((w) => ({
    label: w.label,
    value: filteredWeek(w).reduce(
      (acc, r) => acc + r.projects.filter((p) => p.blockers.trim()).length,
      0,
    ),
  }));

  // Упоминания проектов за период: projectId -> {name, total, perWeek}
  const mentions = new Map<
    string,
    { name: string; total: number; perWeek: Map<string, number> }
  >();
  for (const w of chrono) {
    const weekKey = isoDate(w.startDate);
    for (const r of filteredWeek(w)) {
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

  // Сдача за текущую неделю в разрезе подкоманд команды (обзор, без фильтров).
  const stSize = new Map<string | null, number>();
  for (const u of activeUsers) {
    const k = u.subteamId ?? null;
    stSize.set(k, (stSize.get(k) ?? 0) + 1);
  }
  const stSubmitted = new Map<string | null, number>();
  if (currentWeek) {
    for (const r of currentWeek.reports) {
      if (r.projects.length === 0 || !activeIds.has(r.userId)) continue;
      const k = subteamByUser.get(r.userId) ?? null;
      stSubmitted.set(k, (stSubmitted.get(k) ?? 0) + 1);
    }
  }
  const subteamBreakdown = [
    ...subteamList.map((s) => ({ key: s.id, mapKey: s.id, label: subteamTag(s.key) })),
    ...(stSize.get(null)
      ? [{ key: "NONE", mapKey: null as string | null, label: "Без подкоманды" }]
      : []),
  ].map((b) => ({
    key: b.key,
    label: b.label,
    size: stSize.get(b.mapKey) ?? 0,
    submitted: stSubmitted.get(b.mapKey) ?? 0,
  }));

  return {
    tiles: {
      activeProjects: statusCount("ACTIVE"),
      pausedProjects: statusCount("PAUSED"),
      doneProjects: statusCount("DONE"),
      submittedThisWeek: currentWeek
        ? filteredWeek(currentWeek).filter((r) => r.projects.length > 0).length
        : 0,
      teamSize,
      blockersLastWeek: lastFinishedWeek
        ? filteredWeek(lastFinishedWeek).reduce(
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
    subteamBreakdown,
    topProjects,
    heatmap,
    options: {
      users: activeUsers.map((u) => ({
        id: u.id,
        label: u.name ?? u.email.split("@")[0],
      })),
      projects: allProjects.map((p) => ({ id: p.id, name: p.name })),
      subteams: subteamList.map((s) => ({ id: s.id, key: s.key })),
    },
  };
}

// Сохранение недельного отчёта — общая логика для веб-формы (server action)
// и Telegram-бота. Валидирует неделю и привязывает строки к проектам.

import { prisma } from "@/lib/db";
import { ensureProject, normalizeProjectName } from "@/lib/projects";
import { EDITABLE_WEEKS, isoDate, recentWeeks } from "@/lib/weeks";

export type ProjectInput = {
  name: string;
  done: string;
  blockers: string;
  plans: string;
};

/**
 * Создаёт/обновляет отчёт пользователя за выбранную неделю. Разрешены только
 * текущая и три прошлые недели. Возвращает число сохранённых проектов.
 */
export async function saveUserReport(
  userId: string,
  weekStartIso: string,
  projects: ProjectInput[],
): Promise<number> {
  const target = recentWeeks(EDITABLE_WEEKS).find(
    (w) => isoDate(w.start) === weekStartIso,
  );
  if (!target) {
    throw new Error("Эту неделю уже нельзя заполнить");
  }

  const week = await prisma.week.upsert({
    where: { startDate: target.start },
    update: {},
    create: {
      startDate: target.start,
      endDate: target.end,
      label: target.label,
    },
  });

  const cleaned = projects
    .map((p, i) => ({
      name: normalizeProjectName(p.name),
      done: p.done.trim(),
      blockers: p.blockers.trim(),
      plans: p.plans.trim(),
      order: i,
    }))
    .filter((p) => p.name || p.done || p.blockers || p.plans);

  const rows = await Promise.all(
    cleaned.map(async (p) => ({
      ...p,
      projectId: await ensureProject(p.name),
    })),
  );

  await prisma.report.upsert({
    where: { userId_weekId: { userId, weekId: week.id } },
    update: { projects: { deleteMany: {}, create: rows } },
    create: { userId, weekId: week.id, projects: { create: rows } },
  });

  return rows.length;
}

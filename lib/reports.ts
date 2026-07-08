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

  // Резолвим id проекта по одному разу на уникальное имя, последовательно —
  // так исключаем гонку двойного create одного и того же нового проекта.
  const idByName = new Map<string, string | null>();
  for (const p of cleaned) {
    if (p.name && !idByName.has(p.name)) {
      idByName.set(p.name, await ensureProject(p.name));
    }
  }

  // Оболочку отчёта создаём/находим отдельно, строки пишем через createMany —
  // без вложенной транзакционной записи (надёжнее на пуле Neon).
  const report = await prisma.report.upsert({
    where: { userId_weekId: { userId, weekId: week.id } },
    update: {},
    create: { userId, weekId: week.id },
  });

  await prisma.$transaction([
    prisma.reportProject.deleteMany({ where: { reportId: report.id } }),
    prisma.reportProject.createMany({
      data: cleaned.map((p) => ({
        reportId: report.id,
        projectId: p.name ? (idByName.get(p.name) ?? null) : null,
        name: p.name,
        done: p.done,
        blockers: p.blockers,
        plans: p.plans,
        order: p.order,
      })),
    }),
  ]);

  return cleaned.length;
}

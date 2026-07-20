// Сохранение недельного отчёта — общая логика для веб-формы (server action)
// и Telegram-бота. Валидирует неделю и привязывает строки к проектам.

import { prisma } from "@/lib/db";
import { ensureProject, normalizeProjectName } from "@/lib/projects";
import { EDITABLE_WEEKS, isoDate, recentWeeks } from "@/lib/weeks";
import {
  addWeeks,
  cancelUpcomingVacation,
  closeVacationOnReport,
  setVacation,
} from "@/lib/vacations";

export type ProjectInput = {
  name: string;
  done: string;
  blockers: string;
  plans: string;
};

/**
 * Создаёт/обновляет отчёт пользователя за выбранную неделю. Разрешены только
 * текущая и три прошлые недели. Возвращает число сохранённых проектов.
 * vacation: отметка «со следующей недели в отпуске» из веб-формы; бот
 * параметр не передаёт — тогда отпуска не трогаем (кроме автовозврата).
 */
export async function saveUserReport(
  userId: string,
  weekStartIso: string,
  projects: ProjectInput[],
  vacation?: { enabled: boolean; weeks: number | null },
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

  // Автовозврат: непустой отчёт закрывает отпуск, покрывающий его неделю.
  // Порядок важен: сначала закрываем старый, потом создаём отмеченный в форме.
  if (cleaned.length > 0) {
    await closeVacationOnReport(userId, target.start);
  }
  if (vacation) {
    if (vacation.enabled) {
      await setVacation(userId, addWeeks(target.start, 1), vacation.weeks, userId);
    } else {
      await cancelUpcomingVacation(userId, target.start);
    }
  }

  return cleaned.length;
}

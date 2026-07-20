// Отпуска сотрудников. Гранулярность — рабочая неделя: границы хранятся как
// понедельники (конвенция Week.startDate, всё в UTC). Инвариант: у
// пользователя не больше одного «актуального» отпуска (endDate = null —
// «пока не вернусь» — или endDate >= понедельника текущей недели).
// Исторические отпуска не изменяются — по ним аналитика считает прошлые недели.

import type { Vacation } from "@prisma/client";
import { prisma } from "@/lib/db";
import { currentWeekRange, isoDate, mondayOf } from "@/lib/weeks";

/** Понедельник через n недель от данного (n может быть отрицательным). */
export function addWeeks(weekStart: Date, n: number): Date {
  const d = new Date(weekStart);
  d.setUTCDate(d.getUTCDate() + 7 * n);
  return d;
}

/** Prisma-условие «отпуск покрывает неделю weekStart». */
function covers(weekStart: Date) {
  return {
    startDate: { lte: weekStart },
    OR: [{ endDate: null }, { endDate: { gte: weekStart } }],
  };
}

/** id всех, у кого неделя weekStart покрыта отпуском. */
export async function getVacationingUserIds(
  weekStart: Date,
): Promise<Set<string>> {
  const rows = await prisma.vacation.findMany({
    where: covers(weekStart),
    select: { userId: true },
  });
  return new Set(rows.map((r) => r.userId));
}

/**
 * Отпускники по неделям одним запросом: ключ — isoDate(понедельника),
 * значение — набор userId. Для дашборда и аналитики.
 */
export async function getVacationsByWeek(
  weekStarts: Date[],
): Promise<Map<string, Set<string>>> {
  const result = new Map<string, Set<string>>(
    weekStarts.map((w) => [isoDate(w), new Set<string>()]),
  );
  if (weekStarts.length === 0) return result;
  const min = new Date(Math.min(...weekStarts.map((w) => w.getTime())));
  const max = new Date(Math.max(...weekStarts.map((w) => w.getTime())));
  const rows = await prisma.vacation.findMany({
    where: {
      startDate: { lte: max },
      OR: [{ endDate: null }, { endDate: { gte: min } }],
    },
    select: { userId: true, startDate: true, endDate: true },
  });
  for (const w of weekStarts) {
    const set = result.get(isoDate(w))!;
    for (const v of rows) {
      if (v.startDate <= w && (v.endDate === null || v.endDate >= w)) {
        set.add(v.userId);
      }
    }
  }
  return result;
}

/** Актуальный (идущий или будущий) отпуск пользователя, null если нет. */
export async function getActiveVacation(
  userId: string,
): Promise<Vacation | null> {
  const { start } = currentWeekRange();
  return prisma.vacation.findFirst({
    where: {
      userId,
      OR: [{ endDate: null }, { endDate: { gte: start } }],
    },
    orderBy: { startDate: "desc" },
  });
}

/**
 * Создаёт или заменяет актуальный отпуск: с недели startWeek на weeks недель
 * (null = «пока не вернусь»).
 */
export async function setVacation(
  userId: string,
  startWeek: Date,
  weeks: number | null,
  createdById: string | null,
): Promise<void> {
  const startDate = mondayOf(startWeek);
  const endDate =
    weeks && weeks > 0 ? addWeeks(startDate, Math.floor(weeks) - 1) : null;
  const existing = await getActiveVacation(userId);
  if (existing) {
    await prisma.vacation.update({
      where: { id: existing.id },
      data: { startDate, endDate, createdById },
    });
  } else {
    await prisma.vacation.create({
      data: { userId, startDate, endDate, createdById },
    });
  }
}

/**
 * Удаляет актуальный отпуск, начинающийся строго после недели afterWeek, —
 * сотрудник снял галочку «в отпуске» в отчёте за неделю afterWeek.
 * Уже идущий отпуск не трогаем: его закрывает closeVacationOnReport.
 */
export async function cancelUpcomingVacation(
  userId: string,
  afterWeek: Date,
): Promise<void> {
  const { start } = currentWeekRange();
  await prisma.vacation.deleteMany({
    where: {
      userId,
      startDate: { gt: afterWeek },
      OR: [{ endDate: null }, { endDate: { gte: start } }],
    },
  });
}

/**
 * Досрочно завершает актуальный отпуск (админка): ещё не начавшийся —
 * удаляется, идущий — закрывается прошлой неделей.
 */
export async function endVacationNow(userId: string): Promise<void> {
  const v = await getActiveVacation(userId);
  if (!v) return;
  const { start } = currentWeekRange();
  if (v.startDate >= start) {
    await prisma.vacation.delete({ where: { id: v.id } });
  } else {
    await prisma.vacation.update({
      where: { id: v.id },
      data: { endDate: addWeeks(start, -1) },
    });
  }
}

/**
 * Автовозврат по отчёту: непустой отчёт за неделю weekStart закрывает
 * покрывающий её отпуск. Отпуск, начинавшийся этой же неделей (или позже),
 * удаляется целиком; начавшийся раньше — усекается прошлой неделей.
 * ВАЖНО: при сохранении отчёта вызывать ДО setVacation — иначе сценарий
 * «вышел из отпуска и сразу планирую новый» затрёт только что созданный.
 */
export async function closeVacationOnReport(
  userId: string,
  weekStart: Date,
): Promise<void> {
  const monday = mondayOf(weekStart);
  const v = await prisma.vacation.findFirst({
    where: { userId, ...covers(monday) },
  });
  if (!v) return;
  if (v.startDate.getTime() >= monday.getTime()) {
    await prisma.vacation.delete({ where: { id: v.id } });
  } else {
    await prisma.vacation.update({
      where: { id: v.id },
      data: { endDate: addWeeks(monday, -1) },
    });
  }
}

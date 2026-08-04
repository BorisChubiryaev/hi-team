// Отпуск сотрудника. vacationUntil — последний день отпуска ВКЛЮЧИТЕЛЬНО
// (хранится как дата, UTC-полночь). Пусто = не в отпуске. Пока сотрудник в
// отпуске, от него не ждут отчёт и на него не срабатывают напоминания/ростер.

/** UTC-полночь сегодняшнего дня — для сравнения дат без учёта времени. */
export function startOfTodayUtc(now: Date = new Date()): Date {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

/** В отпуске ли сотрудник прямо сейчас. */
export function isOnVacation(
  user: { vacationUntil: Date | string | null },
  now: Date = new Date(),
): boolean {
  if (!user.vacationUntil) return false;
  const until =
    typeof user.vacationUntil === "string"
      ? new Date(user.vacationUntil)
      : user.vacationUntil;
  return until >= startOfTodayUtc(now);
}

/** Prisma-условие «НЕ в отпуске сейчас» (для where в запросах). */
export function notOnVacationFilter(now: Date = new Date()) {
  return {
    OR: [
      { vacationUntil: null },
      { vacationUntil: { lt: startOfTodayUtc(now) } },
    ],
  };
}

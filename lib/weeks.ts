// Утилиты для работы с рабочими неделями (Пн–Пт) и их подписями на русском.

const MONTHS_GENITIVE = [
  "января",
  "февраля",
  "марта",
  "апреля",
  "мая",
  "июня",
  "июля",
  "августа",
  "сентября",
  "октября",
  "ноября",
  "декабря",
];

/** Понедельник той недели, в которую попадает дата (в UTC, время 00:00). */
export function mondayOf(date: Date): Date {
  const d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const day = d.getUTCDay(); // 0=вс, 1=пн ...
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d;
}

/** Диапазон текущей рабочей недели: { start: Пн, end: Пт }. */
export function currentWeekRange(now: Date = new Date()): {
  start: Date;
  end: Date;
} {
  const start = mondayOf(now);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 4); // пятница
  return { start, end };
}

/** Подпись недели, напр. «15–19 июня» или «29 июня – 3 июля». */
export function formatWeekLabel(start: Date, end: Date): string {
  const d1 = start.getUTCDate();
  const d2 = end.getUTCDate();
  const m1 = MONTHS_GENITIVE[start.getUTCMonth()];
  const m2 = MONTHS_GENITIVE[end.getUTCMonth()];
  if (start.getUTCMonth() === end.getUTCMonth()) {
    return `${d1}–${d2} ${m1}`;
  }
  return `${d1} ${m1} – ${d2} ${m2}`;
}

/** Дата как YYYY-MM-DD (UTC) — удобно для ключей и input[type=date]. */
export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

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

export type WeekOption = { start: Date; end: Date; label: string };

/** Сколько недель доступно для заполнения отчёта: текущая + 3 прошлые. */
export const EDITABLE_WEEKS = 4;

/** Последние `count` рабочих недель: текущая первой, дальше в прошлое. */
export function recentWeeks(count: number, now: Date = new Date()): WeekOption[] {
  const { start } = currentWeekRange(now);
  const weeks: WeekOption[] = [];
  for (let i = 0; i < count; i++) {
    const s = new Date(start);
    s.setUTCDate(s.getUTCDate() - 7 * i);
    const e = new Date(s);
    e.setUTCDate(s.getUTCDate() + 4);
    weeks.push({ start: s, end: e, label: formatWeekLabel(s, e) });
  }
  return weeks;
}

const MONTHS_NOMINATIVE = [
  "январь",
  "февраль",
  "март",
  "апрель",
  "май",
  "июнь",
  "июль",
  "август",
  "сентябрь",
  "октябрь",
  "ноябрь",
  "декабрь",
];

/** Короткая подпись недели для осей: «15–19 июня» → «15–19». */
export function shortWeekLabel(label: string): string {
  const nums = label.match(/\d+/g);
  return nums && nums.length >= 2 ? `${nums[0]}–${nums[1]}` : label;
}

/** Ключ месяца YYYY-MM по дате (UTC). */
export function monthKey(date: Date): string {
  return date.toISOString().slice(0, 7);
}

/** Подпись месяца по ключу YYYY-MM, напр. «июнь 2026». */
export function formatMonthLabel(key: string): string {
  const [year, month] = key.split("-").map(Number);
  return `${MONTHS_NOMINATIVE[(month ?? 1) - 1]} ${year}`;
}

/** Дата по-человечески в UTC, напр. «5 июля 2026». */
export function formatDateHuman(d: Date): string {
  return `${d.getUTCDate()} ${MONTHS_GENITIVE[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

const QUARTER_NAMES = ["I", "II", "III", "IV"];

/** Диапазон квартала, в который попадает дата: { start, end, label }. */
export function quarterRange(now: Date = new Date()): {
  start: Date;
  end: Date;
  label: string;
} {
  const y = now.getUTCFullYear();
  const q = Math.floor(now.getUTCMonth() / 3); // 0..3
  const start = new Date(Date.UTC(y, q * 3, 1));
  const end = new Date(Date.UTC(y, q * 3 + 3, 0)); // последний день квартала
  return { start, end, label: `${QUARTER_NAMES[q]} квартал ${y}` };
}

/** Диапазон предыдущего квартала относительно даты. */
export function previousQuarterRange(now: Date = new Date()): {
  start: Date;
  end: Date;
  label: string;
} {
  const cur = quarterRange(now);
  // Первый день текущего квартала минус один день → попадаем в прошлый квартал.
  const dayBefore = new Date(cur.start);
  dayBefore.setUTCDate(dayBefore.getUTCDate() - 1);
  return quarterRange(dayBefore);
}

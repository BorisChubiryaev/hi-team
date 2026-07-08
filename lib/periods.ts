// Периоды для подготовки к встрече: пресеты кварталов и произвольный диапазон.

import { isoDate } from "@/lib/weeks";

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

const ROMAN = ["I", "II", "III", "IV"];

export type Period = {
  key: string; // «2026-Q2» или «2026-04-01_2026-06-30» для произвольного
  label: string; // «II квартал 2026»
  start: Date;
  end: Date;
};

/** Квартал (1–4), в который попадает дата. */
function quarterOf(date: Date): number {
  return Math.floor(date.getUTCMonth() / 3) + 1;
}

function quarterPeriod(year: number, q: number): Period {
  const startMonth = (q - 1) * 3;
  const start = new Date(Date.UTC(year, startMonth, 1));
  const end = new Date(Date.UTC(year, startMonth + 3, 0)); // последний день квартала
  return {
    key: `${year}-Q${q}`,
    label: `${ROMAN[q - 1]} квартал ${year}`,
    start,
    end,
  };
}

/** Последние `count` кварталов: текущий первым, дальше в прошлое. */
export function recentQuarters(count: number, now: Date = new Date()): Period[] {
  let year = now.getUTCFullYear();
  let q = quarterOf(now);
  const out: Period[] = [];
  for (let i = 0; i < count; i++) {
    out.push(quarterPeriod(year, q));
    q -= 1;
    if (q < 1) {
      q = 4;
      year -= 1;
    }
  }
  return out;
}

/** Разбирает квартальный ключ «2026-Q2» в период, либо null. */
export function parseQuarterKey(key: string): Period | null {
  const m = key.match(/^(\d{4})-Q([1-4])$/);
  if (!m) return null;
  return quarterPeriod(Number(m[1]), Number(m[2]));
}

/** Подпись произвольного диапазона, напр. «1 апреля – 30 июня 2026». */
export function formatPeriodLabel(start: Date, end: Date): string {
  const d1 = start.getUTCDate();
  const m1 = MONTHS_GENITIVE[start.getUTCMonth()];
  const y1 = start.getUTCFullYear();
  const d2 = end.getUTCDate();
  const m2 = MONTHS_GENITIVE[end.getUTCMonth()];
  const y2 = end.getUTCFullYear();
  if (y1 === y2) return `${d1} ${m1} – ${d2} ${m2} ${y2}`;
  return `${d1} ${m1} ${y1} – ${d2} ${m2} ${y2}`;
}

/** Произвольный период из двух ISO-дат (YYYY-MM-DD), с валидацией. */
export function customPeriod(
  startIso: string,
  endIso: string,
): Period | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startIso) || !/^\d{4}-\d{2}-\d{2}$/.test(endIso))
    return null;
  const start = new Date(`${startIso}T00:00:00Z`);
  const end = new Date(`${endIso}T00:00:00Z`);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return null;
  return {
    key: `${isoDate(start)}_${isoDate(end)}`,
    label: formatPeriodLabel(start, end),
    start,
    end,
  };
}

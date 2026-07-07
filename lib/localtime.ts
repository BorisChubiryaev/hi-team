// Локальное время в заданной таймзоне без внешних зависимостей — через Intl.
// Нужно крону, чтобы понять «сейчас нужный день недели и час у команды?».

export type LocalParts = {
  dow: number; // 1=Пн … 7=Вс
  hour: number; // 0–23
  dateKey: string; // YYYY-MM-DD (локальная дата) — для дедупа запусков
};

const DOW: Record<string, number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
};

export function localParts(timezone: string, now: Date = new Date()): LocalParts {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    weekday: "short",
  });
  const parts: Record<string, string> = {};
  for (const p of fmt.formatToParts(now)) parts[p.type] = p.value;

  return {
    dow: DOW[parts.weekday] ?? 1,
    hour: Number(parts.hour),
    dateKey: `${parts.year}-${parts.month}-${parts.day}`,
  };
}

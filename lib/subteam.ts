// Подкоманды (AI / BI) — глобальные «хэштеги» направлений. Команда делится на
// две подгруппы; сотрудник выбирает свою при заполнении отчёта. Используется
// в форме отчёта, на дашборде и при генерации AI-сводки.

import type { Subteam } from "@prisma/client";

/** Порядок разделов в UI и в сводке. */
export const SUBTEAMS: Subteam[] = ["AI", "BI"];

/** Короткая подпись-хэштег для бейджей. */
export function subteamTag(subteam: Subteam): string {
  return `#${subteam}`;
}

/** Человеко-читаемое название раздела. */
export const SUBTEAM_LABELS: Record<Subteam, string> = {
  AI: "Подкоманда AI",
  BI: "Подкоманда BI",
};

/** Валидирует произвольное значение как Subteam (для форм/actions). */
export function parseSubteam(value: unknown): Subteam | null {
  return value === "AI" || value === "BI" ? value : null;
}

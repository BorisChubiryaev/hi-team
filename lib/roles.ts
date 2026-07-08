// Роли и производные от них права.
//
// MEMBER   — «Сотрудник»: пишет отчёты.
// LEAD     — «Сотрудник-расширенный»: пишет отчёты + управление (админка,
//            статусы/переименование/слияние проектов).
// DIRECTOR — «Руководитель»: те же права управления, но отчёты НЕ пишет
//            (нет в колонках дашборда, напоминаниях и счётчике сдачи).

import type { Role } from "@prisma/client";

export const ROLE_LABELS: Record<Role, string> = {
  MEMBER: "Сотрудник",
  LEAD: "Сотрудник-расширенный",
  DIRECTOR: "Руководитель",
};

/** Роли с правами управления (админка, проекты). */
export const MANAGER_ROLES: Role[] = ["LEAD", "DIRECTOR"];

/** Может ли роль управлять (админка, статусы/слияние проектов). */
export function canManage(role: Role): boolean {
  return MANAGER_ROLES.includes(role);
}

/** Ожидается ли от роли еженедельный отчёт. */
export function writesReports(role: Role): boolean {
  return role !== "DIRECTOR";
}

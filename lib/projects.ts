// Работа с проектами как сущностями: нормализация имён и привязка строк
// отчёта к Project (создание по имени при необходимости).

import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";

type Db = PrismaClient | Prisma.TransactionClient;

/** Нормализует имя проекта: трим + схлопывание пробелов. */
export function normalizeProjectName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

/**
 * Находит проект по имени (без учёта регистра) или создаёт новый.
 * Возвращает id проекта либо null для пустого имени.
 */
export async function ensureProject(
  name: string,
  workspaceId: string | null,
  db: Db = prisma,
): Promise<string | null> {
  const normalized = normalizeProjectName(name);
  if (!normalized) return null;

  // Ищем в рамках команды (у каждой команды свой каталог проектов).
  const existing = await db.project.findFirst({
    where: {
      workspaceId,
      name: { equals: normalized, mode: "insensitive" },
    },
    select: { id: true },
  });
  if (existing) return existing.id;

  try {
    const created = await db.project.create({
      data: { name: normalized, workspaceId },
      select: { id: true },
    });
    return created.id;
  } catch {
    // Параллельное создание того же имени — перечитываем.
    const again = await db.project.findFirst({
      where: {
        workspaceId,
        name: { equals: normalized, mode: "insensitive" },
      },
      select: { id: true },
    });
    if (again) return again.id;
    throw new Error(`Не удалось создать проект «${normalized}»`);
  }
}

export const PROJECT_STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Активен",
  PAUSED: "На паузе",
  DONE: "Завершён",
};

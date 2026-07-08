"use server";

import { revalidatePath } from "next/cache";
import type { ProjectStatus } from "@prisma/client";
import { requireManager } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { normalizeProjectName } from "@/lib/projects";

const STATUSES: ProjectStatus[] = ["ACTIVE", "PAUSED", "DONE"];

export type ActionResult = { ok: true } | { ok: false; error: string };

function revalidateProjects(id?: string) {
  revalidatePath("/projects");
  if (id) revalidatePath(`/projects/${id}`);
  revalidatePath("/dashboard");
  revalidatePath("/report");
}

/** Меняет статус проекта (Активен / На паузе / Завершён). Только LEAD. */
export async function setProjectStatus(id: string, status: ProjectStatus) {
  await requireManager();
  if (!STATUSES.includes(status)) throw new Error("Некорректный статус");

  await prisma.project.update({ where: { id }, data: { status } });
  revalidateProjects(id);
}

/**
 * Переименовывает проект. Обновляет и снимки имён в строках отчётов,
 * чтобы дашборд и история показывали одно имя. Только LEAD.
 */
export async function renameProject(
  id: string,
  newName: string,
): Promise<ActionResult> {
  await requireManager();

  const name = normalizeProjectName(newName);
  if (!name) return { ok: false, error: "Имя не может быть пустым" };

  const clash = await prisma.project.findFirst({
    where: { name: { equals: name, mode: "insensitive" }, NOT: { id } },
    select: { name: true },
  });
  if (clash) {
    return {
      ok: false,
      error: `Уже есть проект «${clash.name}» — используйте слияние`,
    };
  }

  await prisma.$transaction([
    prisma.project.update({ where: { id }, data: { name } }),
    prisma.reportProject.updateMany({
      where: { projectId: id },
      data: { name },
    }),
  ]);

  revalidateProjects(id);
  return { ok: true };
}

/**
 * Удаляет проект. Строки отчётов сохраняются: их projectId обнуляется
 * (onDelete: SetNull в схеме), поэтому история и снимки имён не теряются —
 * такие строки просто перестают быть привязаны к сущности проекта. Только LEAD.
 */
export async function deleteProject(id: string): Promise<ActionResult> {
  await requireManager();

  const project = await prisma.project.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!project) return { ok: false, error: "Проект не найден" };

  await prisma.project.delete({ where: { id } });

  revalidateProjects();
  return { ok: true };
}

/**
 * Сливает проект-дубль в целевой: строки отчётов перепривязываются и
 * получают имя целевого проекта, дубль удаляется. AI-сводка целевого
 * проекта сбрасывается — она посчитана по неполным данным. Только LEAD.
 */
export async function mergeProjects(
  sourceId: string,
  targetId: string,
): Promise<ActionResult> {
  await requireManager();

  if (sourceId === targetId) {
    return { ok: false, error: "Нельзя слить проект сам с собой" };
  }
  const [source, target] = await Promise.all([
    prisma.project.findUnique({ where: { id: sourceId } }),
    prisma.project.findUnique({ where: { id: targetId } }),
  ]);
  if (!source || !target) {
    return { ok: false, error: "Проект не найден" };
  }

  await prisma.$transaction([
    prisma.reportProject.updateMany({
      where: { projectId: sourceId },
      data: { projectId: targetId, name: target.name },
    }),
    prisma.project.delete({ where: { id: sourceId } }),
    prisma.project.update({
      where: { id: targetId },
      data: { aiSummary: null, aiSummaryModel: null, aiSummaryAt: null },
    }),
  ]);

  revalidateProjects(targetId);
  return { ok: true };
}

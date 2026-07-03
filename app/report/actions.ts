"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ensureProject, normalizeProjectName } from "@/lib/projects";
import { currentWeekRange, formatWeekLabel } from "@/lib/weeks";

export type ProjectInput = {
  name: string;
  done: string;
  blockers: string;
  plans: string;
};

/** Сохраняет (создаёт или обновляет) отчёт текущего пользователя за текущую неделю. */
export async function saveReport(projects: ProjectInput[]) {
  const user = await requireUser();
  const { start, end } = currentWeekRange();

  const week = await prisma.week.upsert({
    where: { startDate: start },
    update: {},
    create: {
      startDate: start,
      endDate: end,
      label: formatWeekLabel(start, end),
    },
  });

  const cleaned = projects
    .map((p, i) => ({
      name: normalizeProjectName(p.name),
      done: p.done.trim(),
      blockers: p.blockers.trim(),
      plans: p.plans.trim(),
      order: i,
    }))
    .filter((p) => p.name || p.done || p.blockers || p.plans);

  // Привязываем каждую строку к проекту-сущности (создаём по имени при необходимости).
  const rows = await Promise.all(
    cleaned.map(async (p) => ({
      ...p,
      projectId: await ensureProject(p.name),
    })),
  );

  await prisma.report.upsert({
    where: { userId_weekId: { userId: user.id, weekId: week.id } },
    update: {
      projects: {
        deleteMany: {},
        create: rows,
      },
    },
    create: {
      userId: user.id,
      weekId: week.id,
      projects: { create: rows },
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/report");
  revalidatePath("/projects");
}

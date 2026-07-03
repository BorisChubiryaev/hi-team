"use server";

import { revalidatePath } from "next/cache";
import type { ProjectStatus } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

const STATUSES: ProjectStatus[] = ["ACTIVE", "PAUSED", "DONE"];

/** Меняет статус проекта (Активен / На паузе / Завершён). */
export async function setProjectStatus(id: string, status: ProjectStatus) {
  await requireUser();
  if (!STATUSES.includes(status)) throw new Error("Некорректный статус");

  await prisma.project.update({ where: { id }, data: { status } });

  revalidatePath("/projects");
  revalidatePath(`/projects/${id}`);
}

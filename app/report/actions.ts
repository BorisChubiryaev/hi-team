"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { saveUserReport, type ProjectInput } from "@/lib/reports";
import { currentWeekRange, isoDate } from "@/lib/weeks";

export type { ProjectInput };

/** Сохраняет отчёт текущего пользователя за выбранную неделю (по умолчанию — текущую). */
export async function saveReport(
  weekStartIso: string,
  projects: ProjectInput[],
) {
  const user = await requireUser();
  const week = weekStartIso || isoDate(currentWeekRange().start);

  await saveUserReport(user.id, week, projects);

  revalidatePath("/dashboard");
  revalidatePath("/report");
  revalidatePath("/projects");
}

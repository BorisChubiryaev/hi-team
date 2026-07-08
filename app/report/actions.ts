"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { saveUserReport, type ProjectInput } from "@/lib/reports";
import { currentWeekRange, isoDate } from "@/lib/weeks";

export type { ProjectInput };

export type SaveResult = { ok: true } | { ok: false; error: string };

/** Сохраняет отчёт текущего пользователя за выбранную неделю (по умолчанию — текущую). */
export async function saveReport(
  weekStartIso: string,
  projects: ProjectInput[],
): Promise<SaveResult> {
  // requireUser может редиректить (throw NEXT_REDIRECT) — вне try, чтобы не глотать.
  const user = await requireUser();
  const week = weekStartIso || isoDate(currentWeekRange().start);

  try {
    await saveUserReport(user.id, week, projects);
  } catch (e) {
    console.error("saveReport failed:", e);
    const msg = e instanceof Error ? e.message : "Неизвестная ошибка";
    return { ok: false, error: `Не удалось сохранить: ${msg}` };
  }

  revalidatePath("/dashboard");
  revalidatePath("/report");
  revalidatePath("/projects");
  return { ok: true };
}

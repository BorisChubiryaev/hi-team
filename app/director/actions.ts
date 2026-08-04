"use server";

import { revalidatePath } from "next/cache";
import { requireDirector } from "@/lib/auth";
import { saveDirectorReport, type ProjectInput } from "@/lib/reports";
import { currentWeekRange, isoDate } from "@/lib/weeks";

type SaveResult = { ok: true } | { ok: false; error: string };

function isNextControlFlow(e: unknown): boolean {
  if (!e || typeof e !== "object" || !("digest" in e)) return false;
  const digest = (e as { digest?: unknown }).digest;
  return (
    typeof digest === "string" &&
    (digest.startsWith("NEXT_REDIRECT") || digest === "NEXT_NOT_FOUND")
  );
}

/** Сохраняет приватный отчёт руководителя за выбранную неделю. */
export async function saveMyDirectorReport(
  weekStartIso: string,
  projects: ProjectInput[],
): Promise<SaveResult> {
  try {
    const user = await requireDirector();
    const week = weekStartIso || isoDate(currentWeekRange().start);
    await saveDirectorReport(user.id, week, projects);
    revalidatePath("/director");
    return { ok: true };
  } catch (e) {
    if (isNextControlFlow(e)) throw e;
    console.error("saveMyDirectorReport failed:", e);
    const msg = e instanceof Error ? e.message : "Неизвестная ошибка";
    return { ok: false, error: `Не удалось сохранить: ${msg}` };
  }
}

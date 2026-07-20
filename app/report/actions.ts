"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { saveUserReport, type ProjectInput } from "@/lib/reports";
import { currentWeekRange, isoDate } from "@/lib/weeks";

// ВАЖНО: файл с "use server" должен экспортировать только async-функции.
// Типы отсюда НЕ реэкспортируем — реэкспорт импортированного типа Turbopack
// превращает в рантайм-ссылку на стёртый тип и роняет модуль с ReferenceError
// при загрузке. ProjectInput потребители берут из "@/lib/reports".
type SaveResult = { ok: true } | { ok: false; error: string };

/** Управляющие исключения Next (redirect/notFound) нельзя глотать — пробрасываем. */
function isNextControlFlow(e: unknown): boolean {
  if (!e || typeof e !== "object" || !("digest" in e)) return false;
  const digest = (e as { digest?: unknown }).digest;
  return (
    typeof digest === "string" &&
    (digest.startsWith("NEXT_REDIRECT") || digest === "NEXT_NOT_FOUND")
  );
}

/** Сохраняет отчёт текущего пользователя за выбранную неделю (по умолчанию — текущую). */
export async function saveReport(
  weekStartIso: string,
  projects: ProjectInput[],
  vacation?: { enabled: boolean; weeks: number | null },
): Promise<SaveResult> {
  try {
    const user = await requireUser();
    const week = weekStartIso || isoDate(currentWeekRange().start);
    await saveUserReport(user.id, week, projects, vacation);

    revalidatePath("/dashboard");
    revalidatePath("/report");
    revalidatePath("/projects");
    revalidatePath("/admin");
    return { ok: true };
  } catch (e) {
    if (isNextControlFlow(e)) throw e; // redirect на /login и т.п.
    console.error("saveReport failed:", e);
    const msg = e instanceof Error ? e.message : "Неизвестная ошибка";
    return { ok: false, error: `Не удалось сохранить: ${msg}` };
  }
}

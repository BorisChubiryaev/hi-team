"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { improveProjects } from "@/lib/openrouter";
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
  subteamId?: string | null,
): Promise<SaveResult> {
  try {
    const user = await requireUser();
    const week = weekStartIso || isoDate(currentWeekRange().start);
    await saveUserReport(user.id, week, projects, subteamId);

    revalidatePath("/dashboard");
    revalidatePath("/report");
    revalidatePath("/projects");
    return { ok: true };
  } catch (e) {
    if (isNextControlFlow(e)) throw e; // redirect на /login и т.п.
    console.error("saveReport failed:", e);
    const msg = e instanceof Error ? e.message : "Неизвестная ошибка";
    return { ok: false, error: `Не удалось сохранить: ${msg}` };
  }
}

type ImproveResult =
  | { ok: true; projects: ProjectInput[] }
  | { ok: false; error: string };

/**
 * Улучшает формулировки отчёта через ИИ (без выдумок и воды). Принимает
 * один проект (точечно) или все. Возвращает обновлённые поля — форма
 * подставляет их к себе, ничего не сохраняя.
 */
export async function improveReport(
  projects: ProjectInput[],
): Promise<ImproveResult> {
  try {
    await requireUser();
    const hasText = projects.some(
      (p) => p.done.trim() || p.blockers.trim() || p.plans.trim(),
    );
    if (!hasText) {
      return { ok: false, error: "Нечего улучшать — заполните хотя бы одно поле" };
    }
    const improved = await improveProjects(
      projects.map((p) => ({
        name: p.name,
        done: p.done,
        blockers: p.blockers,
        plans: p.plans,
      })),
    );
    return { ok: true, projects: improved };
  } catch (e) {
    if (isNextControlFlow(e)) throw e;
    console.error("improveReport failed:", e);
    const msg = e instanceof Error ? e.message : "Ошибка";
    return { ok: false, error: `Не удалось улучшить: ${msg}` };
  }
}

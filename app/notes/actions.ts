"use server";

import { revalidatePath } from "next/cache";
import { requireDbUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

type ActionResult = { ok: true } | { ok: false; error: string };

/** Создаёт заметку текущего пользователя. */
export async function createNote(content: string): Promise<ActionResult> {
  const me = await requireDbUser();
  const value = content.trim();
  if (!value) return { ok: false, error: "Пустая заметка" };
  await prisma.note.create({ data: { userId: me.id, content: value } });
  revalidatePath("/notes");
  return { ok: true };
}

/** Обновляет заметку — только свою. */
export async function updateNote(
  id: string,
  content: string,
): Promise<ActionResult> {
  const me = await requireDbUser();
  const value = content.trim();
  if (!value) return { ok: false, error: "Пустая заметка" };
  const note = await prisma.note.findUnique({ where: { id } });
  if (!note || note.userId !== me.id) {
    return { ok: false, error: "Заметка не найдена" };
  }
  await prisma.note.update({ where: { id }, data: { content: value } });
  revalidatePath("/notes");
  return { ok: true };
}

/** Удаляет заметку — только свою. */
export async function deleteNote(id: string): Promise<ActionResult> {
  const me = await requireDbUser();
  const note = await prisma.note.findUnique({ where: { id } });
  if (!note || note.userId !== me.id) {
    return { ok: false, error: "Заметка не найдена" };
  }
  await prisma.note.delete({ where: { id } });
  revalidatePath("/notes");
  return { ok: true };
}

"use server";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { isAllowed } from "@/lib/auth";
import { roleForEmail, workspaceIdForEmail } from "@/lib/workspace";

type Result = { ok: true } | { ok: false; error: string };

/**
 * Задаёт пароль для первого входа. Разрешено только почтам из allowlist и
 * только если пароль ещё не задан (иначе — просить войти обычным способом).
 */
export async function setPassword(
  email: string,
  password: string,
  name?: string,
): Promise<Result> {
  const e = email.trim().toLowerCase();
  if (!(await isAllowed(e))) {
    return { ok: false, error: "Эта почта не в списке команды" };
  }
  if (password.length < 6) {
    return { ok: false, error: "Пароль должен быть минимум 6 символов" };
  }
  const cleanName = name?.trim() || null;

  const user = await prisma.user.findUnique({ where: { email: e } });
  if (user?.passwordHash) {
    return { ok: false, error: "Пароль уже задан — просто войдите" };
  }

  // Имя нужно только для НОВОГО аккаунта (первый вход нового человека).
  // При сбросе у существующего аккаунта имя уже есть — если поле оставили
  // пустым, не трогаем его; заполнили — перезаписываем.
  if (!user && !cleanName) {
    return { ok: false, error: "Укажите имя и фамилию" };
  }

  const passwordHash = await bcrypt.hash(password, 10);
  if (user) {
    await prisma.user.update({
      where: { email: e },
      data: { passwordHash, ...(cleanName ? { name: cleanName } : {}) },
    });
  } else {
    // Новый пользователь попадает в команду и роль своей записи allowlist.
    const [workspaceId, role] = await Promise.all([
      workspaceIdForEmail(e),
      roleForEmail(e),
    ]);
    await prisma.user.create({
      data: { email: e, passwordHash, name: cleanName, workspaceId, role },
    });
  }
  return { ok: true };
}

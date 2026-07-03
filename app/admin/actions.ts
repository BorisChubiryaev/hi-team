"use server";

import { revalidatePath } from "next/cache";
import type { Role } from "@prisma/client";
import { requireLead } from "@/lib/auth";
import { prisma } from "@/lib/db";

export type ActionResult = { ok: true } | { ok: false; error: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Меняет роль. Нельзя снять роль с последнего лида — иначе админка недоступна никому. */
export async function setUserRole(
  userId: string,
  role: Role,
): Promise<ActionResult> {
  await requireLead();
  if (role !== "LEAD" && role !== "MEMBER") {
    return { ok: false, error: "Некорректная роль" };
  }

  if (role === "MEMBER") {
    const leads = await prisma.user.count({
      where: { role: "LEAD", active: true },
    });
    const target = await prisma.user.findUnique({ where: { id: userId } });
    if (target?.role === "LEAD" && leads <= 1) {
      return { ok: false, error: "Нельзя снять роль с последнего руководителя" };
    }
  }

  await prisma.user.update({ where: { id: userId }, data: { role } });
  revalidatePath("/admin");
  return { ok: true };
}

/** Активирует/деактивирует сотрудника. Себя деактивировать нельзя. */
export async function setUserActive(
  userId: string,
  active: boolean,
): Promise<ActionResult> {
  const me = await requireLead();
  if (userId === me.id && !active) {
    return { ok: false, error: "Нельзя деактивировать себя" };
  }

  await prisma.user.update({ where: { id: userId }, data: { active } });
  revalidatePath("/admin");
  revalidatePath("/dashboard");
  return { ok: true };
}

/** Сохраняет Telegram chat_id для персональных напоминаний (пусто = убрать). */
export async function setUserTelegram(
  userId: string,
  chatId: string,
): Promise<ActionResult> {
  await requireLead();
  const value = chatId.trim();
  await prisma.user.update({
    where: { id: userId },
    data: { telegramChatId: value || null },
  });
  revalidatePath("/admin");
  return { ok: true };
}

/** Добавляет почту в allowlist. */
export async function addAllowedEmail(email: string): Promise<ActionResult> {
  await requireLead();
  const e = email.trim().toLowerCase();
  if (!EMAIL_RE.test(e)) return { ok: false, error: "Некорректная почта" };

  await prisma.allowedEmail.upsert({
    where: { email: e },
    update: {},
    create: { email: e },
  });
  revalidatePath("/admin");
  return { ok: true };
}

/** Убирает почту из allowlist (существующий пользователь при этом остаётся). */
export async function removeAllowedEmail(id: string): Promise<ActionResult> {
  await requireLead();
  await prisma.allowedEmail.delete({ where: { id } });
  revalidatePath("/admin");
  return { ok: true };
}

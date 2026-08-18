"use server";

import { revalidatePath } from "next/cache";
import type { Role } from "@prisma/client";
import { requireSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

export type ActionResult = { ok: true } | { ok: false; error: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLES: Role[] = ["MEMBER", "LEAD", "DIRECTOR"];

function slugify(name: string): string {
  const s = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s || "team";
}

/** Создаёт команду. slug из имени, при коллизии — с суффиксом. */
export async function createWorkspace(name: string): Promise<ActionResult> {
  await requireSuperAdmin();
  const clean = name.trim();
  if (!clean) return { ok: false, error: "Укажите название команды" };

  const base = slugify(clean);
  let slug = base;
  for (let i = 2; i < 100; i++) {
    const taken = await prisma.workspace.findUnique({ where: { slug } });
    if (!taken) break;
    slug = `${base}-${i}`;
  }
  await prisma.workspace.create({ data: { name: clean, slug } });
  revalidatePath("/superadmin");
  return { ok: true };
}

/** Переименовывает команду. */
export async function renameWorkspace(
  id: string,
  name: string,
): Promise<ActionResult> {
  await requireSuperAdmin();
  const clean = name.trim();
  if (!clean) return { ok: false, error: "Название не может быть пустым" };
  await prisma.workspace.update({ where: { id }, data: { name: clean } });
  revalidatePath("/superadmin");
  return { ok: true };
}

/** Задаёт системные промпты AI-сводок команды (пусто = дефолт из кода). */
export async function setWorkspacePrompts(
  id: string,
  weekPrompt: string,
  monthPrompt: string,
): Promise<ActionResult> {
  await requireSuperAdmin();
  await prisma.workspace.update({
    where: { id },
    data: {
      weekPrompt: weekPrompt.trim() || null,
      monthPrompt: monthPrompt.trim() || null,
    },
  });
  revalidatePath("/superadmin");
  return { ok: true };
}

/** Переносит пользователя в другую команду (пусто = без команды). */
export async function setUserWorkspace(
  userId: string,
  workspaceId: string,
): Promise<ActionResult> {
  await requireSuperAdmin();
  await prisma.user.update({
    where: { id: userId },
    data: { workspaceId: workspaceId || null },
  });
  revalidatePath("/superadmin");
  return { ok: true };
}

/** Задаёт роль пользователя (супер-админ выше проверки «последнего управляющего»). */
export async function saSetUserRole(
  userId: string,
  role: Role,
): Promise<ActionResult> {
  await requireSuperAdmin();
  if (!ROLES.includes(role)) return { ok: false, error: "Некорректная роль" };
  await prisma.user.update({ where: { id: userId }, data: { role } });
  revalidatePath("/superadmin");
  return { ok: true };
}

/** Делает пользователя супер-админом или снимает флаг. */
export async function setUserSuperAdmin(
  userId: string,
  value: boolean,
): Promise<ActionResult> {
  const me = await requireSuperAdmin();
  if (userId === me.id && !value) {
    const others = await prisma.user.count({
      where: { isSuperAdmin: true, id: { not: me.id } },
    });
    if (others === 0) {
      return { ok: false, error: "Нельзя снять последнего супер-админа" };
    }
  }
  await prisma.user.update({
    where: { id: userId },
    data: { isSuperAdmin: value },
  });
  revalidatePath("/superadmin");
  return { ok: true };
}

/** Добавляет почту в allowlist конкретной команды (новый человек попадёт в неё). */
export async function addAllowedEmailToWorkspace(
  workspaceId: string,
  email: string,
): Promise<ActionResult> {
  await requireSuperAdmin();
  const e = email.trim().toLowerCase();
  if (!EMAIL_RE.test(e)) return { ok: false, error: "Некорректная почта" };
  if (!workspaceId) return { ok: false, error: "Выберите команду" };
  await prisma.allowedEmail.upsert({
    where: { email: e },
    update: { workspaceId },
    create: { email: e, workspaceId },
  });
  revalidatePath("/superadmin");
  return { ok: true };
}

/** Добавляет подкоманду (направление) в команду. */
export async function addSubteam(
  workspaceId: string,
  key: string,
  label: string,
): Promise<ActionResult> {
  await requireSuperAdmin();
  if (!workspaceId) return { ok: false, error: "Выберите команду" };
  const k = key.trim();
  const l = label.trim() || k;
  if (!k) return { ok: false, error: "Укажите тег (напр. AI)" };
  const exists = await prisma.subteam.findFirst({ where: { workspaceId, key: k } });
  if (exists) return { ok: false, error: "Такой тег уже есть в команде" };
  const count = await prisma.subteam.count({ where: { workspaceId } });
  await prisma.subteam.create({
    data: { workspaceId, key: k, label: l, order: count },
  });
  revalidatePath("/superadmin");
  return { ok: true };
}

/** Удаляет подкоманду (у сотрудников она обнулится — onDelete: SetNull). */
export async function removeSubteam(id: string): Promise<ActionResult> {
  await requireSuperAdmin();
  await prisma.subteam.delete({ where: { id } });
  revalidatePath("/superadmin");
  return { ok: true };
}

/** Удаляет почту из allowlist. */
export async function removeAllowedEmail(id: string): Promise<ActionResult> {
  await requireSuperAdmin();
  await prisma.allowedEmail.delete({ where: { id } });
  revalidatePath("/superadmin");
  return { ok: true };
}

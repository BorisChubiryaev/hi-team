"use server";

import { revalidatePath } from "next/cache";
import type { Role } from "@prisma/client";
import { requireManager } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { TIMEZONES } from "@/lib/bot-constants";
import { sendGroupRoster, sendReminders } from "@/lib/reminders";
import { canManage, MANAGER_ROLES } from "@/lib/roles";

export type ActionResult = { ok: true } | { ok: false; error: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLES: Role[] = ["MEMBER", "LEAD", "DIRECTOR"];

/** Меняет роль. Нельзя убрать последнего управляющего — иначе админка недоступна никому. */
export async function setUserRole(
  userId: string,
  role: Role,
): Promise<ActionResult> {
  await requireManager();
  if (!ROLES.includes(role)) {
    return { ok: false, error: "Некорректная роль" };
  }

  // Смена, отнимающая права управления, — проверяем, что останется хоть один управляющий.
  if (!canManage(role)) {
    const target = await prisma.user.findUnique({ where: { id: userId } });
    if (target && canManage(target.role) && target.active) {
      const managers = await prisma.user.count({
        where: { role: { in: MANAGER_ROLES }, active: true },
      });
      if (managers <= 1) {
        return {
          ok: false,
          error: "Нельзя убрать роль у последнего управляющего",
        };
      }
    }
  }

  await prisma.user.update({ where: { id: userId }, data: { role } });
  revalidatePath("/admin");
  revalidatePath("/dashboard");
  return { ok: true };
}

/** Активирует/деактивирует сотрудника. Себя деактивировать нельзя. */
export async function setUserActive(
  userId: string,
  active: boolean,
): Promise<ActionResult> {
  const me = await requireManager();
  if (userId === me.id && !active) {
    return { ok: false, error: "Нельзя деактивировать себя" };
  }

  await prisma.user.update({ where: { id: userId }, data: { active } });
  revalidatePath("/admin");
  revalidatePath("/dashboard");
  return { ok: true };
}

/**
 * Полностью удаляет пользователя вместе с его отчётами (каскад в схеме).
 * Себя удалить нельзя; последнего руководителя — тоже. Для «ушёл из команды,
 * но историю сохранить» используйте деактивацию. Только LEAD.
 */
export async function deleteUser(userId: string): Promise<ActionResult> {
  const me = await requireManager();
  if (userId === me.id) {
    return { ok: false, error: "Нельзя удалить себя" };
  }

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) return { ok: false, error: "Пользователь не найден" };

  if (canManage(target.role)) {
    const managers = await prisma.user.count({
      where: { role: { in: MANAGER_ROLES } },
    });
    if (managers <= 1) {
      return { ok: false, error: "Нельзя удалить последнего управляющего" };
    }
  }

  await prisma.user.delete({ where: { id: userId } });
  revalidatePath("/admin");
  revalidatePath("/dashboard");
  return { ok: true };
}

/** Сохраняет Telegram chat_id для персональных напоминаний (пусто = убрать). */
export async function setUserTelegram(
  userId: string,
  chatId: string,
): Promise<ActionResult> {
  await requireManager();
  const value = chatId.trim();
  await prisma.user.update({
    where: { id: userId },
    data: { telegramChatId: value || null },
  });
  revalidatePath("/admin");
  return { ok: true };
}

/** Сохраняет настройки бота (расписание напоминаний и групповой сводки). */
export async function updateBotSettings(input: {
  reminderEnabled: boolean;
  reminderDow: number;
  reminderHour: number;
  groupEnabled: boolean;
  groupDow: number;
  groupHour: number;
  timezone: string;
}): Promise<ActionResult> {
  await requireManager();

  const clampDow = (n: number) => Math.min(7, Math.max(1, Math.floor(n)));
  const clampHour = (n: number) => Math.min(23, Math.max(0, Math.floor(n)));
  const timezone = TIMEZONES.some((t) => t.value === input.timezone)
    ? input.timezone
    : "Europe/Moscow";

  const data = {
    reminderEnabled: input.reminderEnabled,
    reminderDow: clampDow(input.reminderDow),
    reminderHour: clampHour(input.reminderHour),
    groupEnabled: input.groupEnabled,
    groupDow: clampDow(input.groupDow),
    groupHour: clampHour(input.groupHour),
    timezone,
  };

  await prisma.botSettings.upsert({
    where: { id: "singleton" },
    update: data,
    create: { id: "singleton", ...data },
  });
  revalidatePath("/admin");
  return { ok: true };
}

/** Немедленно отправить личные напоминания (тест/ручной запуск). Только LEAD. */
export async function sendReminderNow(): Promise<{ message: string }> {
  await requireManager();
  const r = await sendReminders();
  return {
    message: r.allDone
      ? "Все уже сдали — уведомил руководителей."
      : `Отправлено напоминаний: ${r.notified} из ${r.missing} не сдавших (у остальных не привязан Telegram).`,
  };
}

/** Немедленно отправить сводку в общий чат. Только LEAD. */
export async function sendGroupRosterNow(): Promise<{ message: string }> {
  await requireManager();
  const s = await prisma.botSettings.findUnique({ where: { id: "singleton" } });
  if (!s?.groupChatId) {
    return {
      message: "Групповой чат не подключён. Добавьте бота в чат и отправьте /here.",
    };
  }
  const ok = await sendGroupRoster(s.groupChatId);
  return {
    message: ok
      ? "Сводка отправлена в общий чат."
      : "Не удалось отправить — проверьте, что бот всё ещё в чате.",
  };
}

/** Добавляет почту в allowlist. */
export async function addAllowedEmail(email: string): Promise<ActionResult> {
  await requireManager();
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
  await requireManager();
  await prisma.allowedEmail.delete({ where: { id } });
  revalidatePath("/admin");
  return { ok: true };
}

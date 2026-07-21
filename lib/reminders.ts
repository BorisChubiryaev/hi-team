// Статус недели (кто сдал / кто нет) и рассылки бота: личные напоминания
// не сдавшим и групповой ростер в общий чат.

import { prisma } from "@/lib/db";
import { sendTelegram } from "@/lib/notify";
import { MANAGER_ROLES } from "@/lib/roles";
import { currentWeekRange, formatWeekLabel } from "@/lib/weeks";
import { getVacationingUserIds } from "@/lib/vacations";

type UserLite = {
  id: string;
  name: string | null;
  email: string;
  telegramChatId: string | null;
};

function appUrl(): string {
  return process.env.APP_URL || "http://localhost:3000";
}

function nameOf(u: { name: string | null; email: string }): string {
  return u.name ?? u.email.split("@")[0];
}

/** Кто сдал / кто в отпуске / кто не сдал за текущую неделю (среди активных). */
export async function getWeekStatus(): Promise<{
  label: string;
  submitted: UserLite[];
  vacation: UserLite[];
  missing: UserLite[];
}> {
  const { start, end } = currentWeekRange();
  const label = formatWeekLabel(start, end);

  const [users, week, vacationIds] = await Promise.all([
    // Отчёт ждём только от пишущих его ролей (Руководитель не пишет).
    prisma.user.findMany({
      where: { active: true, role: { not: "DIRECTOR" } },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, email: true, telegramChatId: true },
    }),
    prisma.week.findUnique({
      where: { startDate: start },
      include: { reports: { include: { projects: true } } },
    }),
    getVacationingUserIds(start),
  ]);

  const submittedIds = new Set(
    (week?.reports ?? [])
      .filter((r) => r.projects.length > 0)
      .map((r) => r.userId),
  );
  // Сдавший в отпуске считается сдавшим (автовозврат закроет отпуск).
  return {
    label,
    submitted: users.filter((u) => submittedIds.has(u.id)),
    vacation: users.filter(
      (u) => !submittedIds.has(u.id) && vacationIds.has(u.id),
    ),
    missing: users.filter(
      (u) => !submittedIds.has(u.id) && !vacationIds.has(u.id),
    ),
  };
}

/**
 * Личные напоминания в ЛС тем, кто не сдал. Если сдали все — вместо спама
 * уведомляем руководителей «все сдали».
 */
export async function sendReminders(): Promise<{
  allDone: boolean;
  missing: number;
  notified: number;
}> {
  const { label, missing } = await getWeekStatus();

  if (missing.length === 0) {
    const leads = await prisma.user.findMany({
      where: {
        role: { in: MANAGER_ROLES },
        active: true,
        telegramChatId: { not: null },
      },
      select: { telegramChatId: true },
    });
    let notified = 0;
    for (const l of leads) {
      if (l.telegramChatId && (await sendTelegram(l.telegramChatId, `✅ Все сдали отчёт за неделю ${label}. Красота!`))) {
        notified++;
      }
    }
    return { allDone: true, missing: 0, notified };
  }

  let notified = 0;
  for (const u of missing) {
    if (!u.telegramChatId) continue;
    const ok = await sendTelegram(
      u.telegramChatId,
      `⏰ ${nameOf(u)}, напоминаю: отчёт за неделю ${label} ещё не сдан.\n` +
        `Заполнить на сайте: ${appUrl()}/report\n` +
        `Или пришлите прямо сюда — команда /report.`,
    );
    if (ok) notified++;
  }
  return { allDone: false, missing: missing.length, notified };
}

/** Ростер в общий чат: кто сдал / в отпуске / кто нет (или «сдали все»). */
export async function sendGroupRoster(chatId: string): Promise<boolean> {
  const { label, submitted, vacation, missing } = await getWeekStatus();

  const vacationLine = vacation.length
    ? `\n🏖 В отпуске (${vacation.length}): ${vacation.map(nameOf).join(", ")}`
    : "";

  let text: string;
  if (missing.length === 0) {
    text = `✅ Отчёты за неделю ${label}: сдали все (${submitted.length}). Спасибо команде!${vacationLine}`;
  } else {
    const done = submitted.length ? submitted.map(nameOf).join(", ") : "—";
    const not = missing.map(nameOf).join(", ");
    text =
      `📋 Отчёты за неделю ${label}\n\n` +
      `✅ Сдали (${submitted.length}): ${done}\n` +
      `⏳ Не сдали (${missing.length}): ${not}${vacationLine}\n\n` +
      `Заполнить: ${appUrl()}/report`;
  }
  return sendTelegram(chatId, text);
}

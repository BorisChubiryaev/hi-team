// Статус недели (кто сдал / кто нет) и рассылки бота: личные напоминания
// не сдавшим и групповой ростер в общий чат.

import { prisma } from "@/lib/db";
import { sendTelegram } from "@/lib/notify";
import { currentWeekRange, formatWeekLabel } from "@/lib/weeks";

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

/** Кто сдал и кто нет за текущую неделю (среди активных сотрудников). */
export async function getWeekStatus(): Promise<{
  label: string;
  submitted: UserLite[];
  missing: UserLite[];
}> {
  const { start, end } = currentWeekRange();
  const label = formatWeekLabel(start, end);

  const [users, week] = await Promise.all([
    prisma.user.findMany({
      where: { active: true },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, email: true, telegramChatId: true },
    }),
    prisma.week.findUnique({
      where: { startDate: start },
      include: { reports: { include: { projects: true } } },
    }),
  ]);

  const submittedIds = new Set(
    (week?.reports ?? [])
      .filter((r) => r.projects.length > 0)
      .map((r) => r.userId),
  );
  return {
    label,
    submitted: users.filter((u) => submittedIds.has(u.id)),
    missing: users.filter((u) => !submittedIds.has(u.id)),
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
      where: { role: "LEAD", active: true, telegramChatId: { not: null } },
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

/** Ростер в общий чат: кто сдал / кто нет (или «сдали все»). */
export async function sendGroupRoster(chatId: string): Promise<boolean> {
  const { label, submitted, missing } = await getWeekStatus();

  let text: string;
  if (missing.length === 0) {
    text = `✅ Отчёты за неделю ${label}: сдали все (${submitted.length}). Спасибо команде!`;
  } else {
    const done = submitted.length ? submitted.map(nameOf).join(", ") : "—";
    const not = missing.map(nameOf).join(", ");
    text =
      `📋 Отчёты за неделю ${label}\n\n` +
      `✅ Сдали (${submitted.length}): ${done}\n` +
      `⏳ Не сдали (${missing.length}): ${not}\n\n` +
      `Заполнить: ${appUrl()}/report`;
  }
  return sendTelegram(chatId, text);
}

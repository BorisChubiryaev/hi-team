"use server";

import { requireDbUser } from "@/lib/auth";
import { sendSummaryEmail } from "@/lib/email";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type SendResult = { ok: true } | { ok: false; error: string };

/** Отправляет текст AI-сводки на указанную почту. Только для авторизованных. */
export async function sendSummaryByEmail(input: {
  to: string;
  subject: string;
  content: string;
}): Promise<SendResult> {
  await requireDbUser();

  const to = input.to.trim().toLowerCase();
  if (!EMAIL_RE.test(to)) return { ok: false, error: "Некорректная почта" };
  if (!input.content.trim()) return { ok: false, error: "Нет текста для отправки" };

  return sendSummaryEmail({
    to,
    subject: input.subject.trim() || "AI-сводка hi-team",
    markdown: input.content,
  });
}

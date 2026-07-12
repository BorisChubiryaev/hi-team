// Отправка писем. По умолчанию — через SMTP твоего Gmail (nodemailer): это
// позволяет слать отчёты на ЛЮБЫЕ адреса без собственного домена. Если Gmail
// не сконфигурирован, но есть RESEND_API_KEY — используется Resend (в тестовом
// режиме он шлёт только на адрес владельца аккаунта). Все секреты берутся из
// окружения и никогда не уходят в браузер. Тело письма — Markdown → HTML.

import nodemailer from "nodemailer";
import { Resend } from "resend";
import { marked } from "marked";

type SendResult = { ok: true } | { ok: false; error: string };

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function renderEmailHtml(title: string, markdown: string): Promise<string> {
  const body = await marked.parse(markdown, { async: true });
  return `<!doctype html><html><body style="margin:0;background:#fffdf9;">
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#171717;max-width:640px;margin:0 auto;padding:24px;line-height:1.5;font-size:15px;">
    <h1 style="font-size:20px;margin:0 0 16px;font-weight:600;">${escapeHtml(title)}</h1>
    <div style="color:#333;">${body}</div>
    <hr style="border:none;border-top:1px solid #eee;margin:24px 0 8px;">
    <p style="font-size:12px;color:#999;margin:0;">Отправлено из hi-team</p>
  </div>
</body></html>`;
}

/** Отправляет письмо с AI-сводкой. Возвращает результат вместо исключения. */
export async function sendSummaryEmail({
  to,
  subject,
  markdown,
}: {
  to: string;
  subject: string;
  markdown: string;
}): Promise<SendResult> {
  const gmailUser = process.env.GMAIL_USER;
  const gmailPass = process.env.GMAIL_APP_PASSWORD;

  try {
    const html = await renderEmailHtml(subject, markdown);

    // Основной путь: SMTP Gmail. Шлёт на любые адреса, домен не нужен.
    if (gmailUser && gmailPass) {
      const from = process.env.EMAIL_FROM || `hi-team <${gmailUser}>`;
      const transport = nodemailer.createTransport({
        service: "gmail",
        auth: { user: gmailUser, pass: gmailPass },
      });
      await transport.sendMail({ from, to, subject, html, text: markdown });
      return { ok: true };
    }

    // Запасной путь: Resend (тестовый режим — только на адрес владельца).
    const apiKey = process.env.RESEND_API_KEY;
    if (apiKey) {
      const from = process.env.EMAIL_FROM || "hi-team <onboarding@resend.dev>";
      const resend = new Resend(apiKey);
      const { error } = await resend.emails.send({
        from,
        to,
        subject,
        html,
        text: markdown,
      });
      if (error) {
        return { ok: false, error: error.message || "Не удалось отправить письмо" };
      }
      return { ok: true };
    }

    return {
      ok: false,
      error:
        "Отправка почты не настроена: задайте GMAIL_USER и GMAIL_APP_PASSWORD (или RESEND_API_KEY)",
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Не удалось отправить письмо",
    };
  }
}

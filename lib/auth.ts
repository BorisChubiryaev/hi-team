import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Resend from "next-auth/providers/resend";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";

/** Почты команды, которым разрешён вход (env ALLOWED_EMAILS, через запятую). */
function allowedEmails(): string[] {
  return (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

const EMAIL_FROM = process.env.EMAIL_FROM || "onboarding@resend.dev";

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  trustHost: true,
  session: { strategy: "database" },
  pages: {
    signIn: "/login",
    verifyRequest: "/login?check=1",
    error: "/login",
  },
  providers: [
    Resend({
      apiKey: process.env.AUTH_RESEND_KEY,
      from: EMAIL_FROM,
      // Кастомная отправка: без ключа Resend (локальная разработка) —
      // печатаем ссылку входа в консоль сервера вместо письма.
      async sendVerificationRequest({ identifier: email, url }) {
        if (!process.env.AUTH_RESEND_KEY) {
          console.log(`\n🔑 Magic-link для ${email}:\n${url}\n`);
          return;
        }
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.AUTH_RESEND_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: EMAIL_FROM,
            to: email,
            subject: "Вход в hi-team",
            html: `
              <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto">
                <h2>Вход в hi-team</h2>
                <p>Нажмите кнопку, чтобы войти в приложение еженедельных отчётов:</p>
                <p style="margin:24px 0">
                  <a href="${url}" style="background:#2563eb;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block">Войти</a>
                </p>
                <p style="color:#666;font-size:13px">Ссылка действует ограниченное время. Если вы не запрашивали вход — проигнорируйте это письмо.</p>
              </div>`,
          }),
        });
        if (!res.ok) {
          throw new Error(`Resend error: ${await res.text()}`);
        }
      },
    }),
  ],
  callbacks: {
    // Пускаем только почты из allowlist (если он задан).
    async signIn({ user }) {
      const allowed = allowedEmails();
      if (allowed.length === 0) return true;
      return !!user.email && allowed.includes(user.email.toLowerCase());
    },
    // Прокидываем id пользователя в сессию.
    session({ session, user }) {
      if (session.user) session.user.id = user.id;
      return session;
    },
  },
});

/** Возвращает текущего пользователя или редиректит на /login. */
export async function requireUser() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return session.user;
}

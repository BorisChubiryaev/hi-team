import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { canManage } from "@/lib/roles";

/** Почты команды из env ALLOWED_EMAILS (fallback, пока таблица allowlist пуста). */
export function allowedEmailsFromEnv(): string[] {
  return (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * true, если почте разрешён вход. Основной источник — таблица AllowedEmail
 * (управляется из админки); если она пуста — fallback на env ALLOWED_EMAILS;
 * если и там пусто — пускаем всех (как раньше).
 */
export async function isAllowed(email: string): Promise<boolean> {
  const e = email.toLowerCase();
  const dbCount = await prisma.allowedEmail.count();
  if (dbCount > 0) {
    const hit = await prisma.allowedEmail.findUnique({ where: { email: e } });
    return hit !== null;
  }
  const env = allowedEmailsFromEnv();
  return env.length === 0 || env.includes(e);
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Пароль", type: "password" },
      },
      authorize: async (credentials) => {
        const email = String(credentials?.email ?? "")
          .trim()
          .toLowerCase();
        const password = String(credentials?.password ?? "");
        if (!email || !password || !(await isAllowed(email))) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user?.passwordHash || !user.active) return null;

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;

        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    session({ session, token }) {
      if (session.user && token.id) session.user.id = String(token.id);
      return session;
    },
  },
});

/** Возвращает текущего пользователя сессии или редиректит на /login. */
export async function requireUser() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return session.user;
}

/**
 * Пользователь из БД (роль всегда свежая, не из JWT).
 * Деактивированных разлогиниваем редиректом на /login.
 */
export async function requireDbUser() {
  const sessionUser = await requireUser();
  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
  });
  if (!user || !user.active) redirect("/login");
  return user;
}

/** Только для управляющих ролей (LEAD/DIRECTOR); остальных — на дашборд. */
export async function requireManager() {
  const user = await requireDbUser();
  if (!canManage(user.role)) redirect("/dashboard");
  return user;
}

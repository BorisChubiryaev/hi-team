import Header from "@/components/Header";
import AdminUserRow from "@/components/AdminUserRow";
import AllowlistManager from "@/components/AllowlistManager";
import BotSettingsPanel from "@/components/BotSettingsPanel";
import { requireLead } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const me = await requireLead();

  const [users, allowed, bot] = await Promise.all([
    prisma.user.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.allowedEmail.findMany({ orderBy: { email: "asc" } }),
    prisma.botSettings.findUnique({ where: { id: "singleton" } }),
  ]);

  return (
    <>
      <Header email={me.email} active="admin" isLead />
      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
        <div className="mb-5">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            Команда
          </h1>
          <p className="mt-1 text-sm text-muted">
            Роли, доступ и персональные напоминания. Деактивированные не могут
            войти и не показываются на дашборде.
          </p>
        </div>

        <div className="mb-6 overflow-x-auto rounded-xl border border-line-strong">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-panel">
                <Th>Сотрудник</Th>
                <Th>Роль</Th>
                <Th>Доступ</Th>
                <Th>Telegram (личные напоминания)</Th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <AdminUserRow key={u.id} user={u} isSelf={u.id === me.id} />
              ))}
            </tbody>
          </table>
        </div>

        <AllowlistManager
          emails={allowed}
          usingEnvFallback={allowed.length === 0}
        />

        <BotSettingsPanel
          reminderEnabled={bot?.reminderEnabled ?? false}
          reminderDow={bot?.reminderDow ?? 4}
          reminderHour={bot?.reminderHour ?? 10}
          groupEnabled={bot?.groupEnabled ?? false}
          groupDow={bot?.groupDow ?? 5}
          groupHour={bot?.groupHour ?? 12}
          timezone={bot?.timezone ?? "Europe/Moscow"}
          groupChatId={bot?.groupChatId ?? null}
          groupTitle={bot?.groupTitle ?? null}
        />
      </main>
    </>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="border-b border-line-strong p-3 text-left font-semibold text-ink">
      {children}
    </th>
  );
}

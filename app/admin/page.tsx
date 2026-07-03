import Header from "@/components/Header";
import AdminUserRow from "@/components/AdminUserRow";
import AllowlistManager from "@/components/AllowlistManager";
import { requireLead } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const me = await requireLead();

  const [users, allowed] = await Promise.all([
    prisma.user.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.allowedEmail.findMany({ orderBy: { email: "asc" } }),
  ]);

  return (
    <>
      <Header email={me.email} active="admin" isLead />
      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
        <div className="mb-5">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
            Команда
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Роли, доступ и персональные напоминания. Деактивированные не могут
            войти и не показываются на дашборде.
          </p>
        </div>

        <div className="mb-6 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900">
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
      </main>
    </>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="border-b border-slate-200 p-3 text-left font-semibold text-slate-700 dark:border-slate-800 dark:text-slate-200">
      {children}
    </th>
  );
}

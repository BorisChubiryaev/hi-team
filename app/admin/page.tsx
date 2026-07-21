import Header from "@/components/Header";
import AdminUserRow from "@/components/AdminUserRow";
import AllowlistManager from "@/components/AllowlistManager";
import BotSettingsPanel from "@/components/BotSettingsPanel";
import { requireManager } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { currentWeekRange, formatDateHuman } from "@/lib/weeks";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const me = await requireManager();

  const { start: weekStart } = currentWeekRange();
  const [users, allowed, bot, vacations] = await Promise.all([
    prisma.user.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.allowedEmail.findMany({ orderBy: { email: "asc" } }),
    prisma.botSettings.findUnique({ where: { id: "singleton" } }),
    prisma.vacation.findMany({
      where: { OR: [{ endDate: null }, { endDate: { gte: weekStart } }] },
    }),
  ]);
  const vacationByUser = new Map(vacations.map((v) => [v.userId, v]));

  // «с 27 июля по 7 августа» / «с 27 июля, до возвращения»;
  // конец показываем пятницей последней недели.
  const vacationLabel = (v: { startDate: Date; endDate: Date | null }) => {
    const from = `с ${formatDateHuman(v.startDate)}`;
    if (!v.endDate) return `${from}, до возвращения`;
    const friday = new Date(v.endDate);
    friday.setUTCDate(friday.getUTCDate() + 4);
    return `${from} по ${formatDateHuman(friday)}`;
  };

  return (
    <>
      <Header email={me.email} active="admin" role={me.role} />
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
                <Th>Отпуск</Th>
                <Th>Telegram (личные напоминания)</Th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const v = vacationByUser.get(u.id);
                return (
                  <AdminUserRow
                    key={u.id}
                    user={u}
                    isSelf={u.id === me.id}
                    vacation={
                      v
                        ? { label: vacationLabel(v), started: v.startDate <= weekStart }
                        : null
                    }
                  />
                );
              })}
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

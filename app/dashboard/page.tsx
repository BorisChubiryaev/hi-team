import Link from "next/link";
import Header from "@/components/Header";
import SummaryCell from "@/components/SummaryCell";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

function displayName(user: { name: string | null; email: string }) {
  return user.name ?? user.email.split("@")[0];
}

export default async function DashboardPage() {
  const me = await requireUser();

  const [users, weeks] = await Promise.all([
    prisma.user.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.week.findMany({
      orderBy: { startDate: "desc" },
      include: {
        summary: true,
        reports: { include: { projects: { orderBy: { order: "asc" } } } },
      },
    }),
  ]);

  // weekId -> userId -> projects
  const byWeekUser = new Map<string, Map<string, (typeof weeks)[number]["reports"][number]["projects"]>>();
  for (const w of weeks) {
    const m = new Map<string, (typeof weeks)[number]["reports"][number]["projects"]>();
    for (const r of w.reports) m.set(r.userId, r.projects);
    byWeekUser.set(w.id, m);
  }

  return (
    <>
      <Header email={me.email} active="dashboard" />
      <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
              Еженедельные отчёты
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Недели по строкам, сотрудники по столбцам. Последняя колонка —
              AI-сводка для руководителя.
            </p>
          </div>
          <Link
            href="/report"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
          >
            Заполнить мой отчёт
          </Link>
        </div>

        {weeks.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 p-10 text-center text-slate-500 dark:border-slate-700">
            Пока нет ни одного отчёта.{" "}
            <Link href="/report" className="text-blue-600 underline">
              Создайте первый
            </Link>
            .
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900">
                  <th className="sticky left-0 z-10 min-w-[110px] border-b border-r border-slate-200 bg-slate-50 p-3 text-left font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
                    Неделя
                  </th>
                  {users.map((u) => (
                    <th
                      key={u.id}
                      className="min-w-[260px] border-b border-r border-slate-200 p-3 text-left font-semibold text-slate-700 dark:border-slate-800 dark:text-slate-200"
                    >
                      {displayName(u)}
                    </th>
                  ))}
                  <th className="min-w-[300px] border-b border-slate-200 bg-blue-50/50 p-3 text-left font-semibold text-blue-800 dark:border-slate-800 dark:bg-blue-950/40 dark:text-blue-200">
                    AI Суммаризатор
                  </th>
                </tr>
              </thead>
              <tbody>
                {weeks.map((w) => {
                  const userMap = byWeekUser.get(w.id)!;
                  return (
                    <tr key={w.id} className="align-top">
                      <th className="sticky left-0 z-10 border-b border-r border-slate-200 bg-white p-3 text-left align-top font-medium text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">
                        {w.label}
                      </th>
                      {users.map((u) => {
                        const projects = userMap.get(u.id);
                        return (
                          <td
                            key={u.id}
                            className="border-b border-r border-slate-200 p-3 align-top dark:border-slate-800"
                          >
                            {projects && projects.length > 0 ? (
                              <div className="space-y-3">
                                {projects.map((p) => (
                                  <ProjectBlock key={p.id} project={p} />
                                ))}
                              </div>
                            ) : (
                              <span className="text-slate-300 dark:text-slate-700">
                                —
                              </span>
                            )}
                          </td>
                        );
                      })}
                      <td className="border-b border-slate-200 bg-blue-50/30 p-3 align-top dark:border-slate-800 dark:bg-blue-950/20">
                        <SummaryCell
                          weekId={w.id}
                          initialContent={w.summary?.content ?? null}
                          initialModel={w.summary?.model ?? null}
                          hasReports={w.reports.length > 0}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </>
  );
}

function ProjectBlock({
  project,
}: {
  project: {
    name: string;
    done: string;
    blockers: string;
    plans: string;
  };
}) {
  return (
    <div className="rounded-lg bg-slate-50 p-2.5 dark:bg-slate-900">
      {project.name && (
        <p className="font-medium text-slate-900 dark:text-white">
          {project.name}
        </p>
      )}
      <Section label="Сделано" value={project.done} tone="emerald" />
      <Section label="Блокеры" value={project.blockers} tone="red" />
      <Section label="Планы" value={project.plans} tone="blue" />
    </div>
  );
}

function Section({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "emerald" | "red" | "blue";
}) {
  if (!value.trim()) return null;
  const toneClass = {
    emerald: "text-emerald-700 dark:text-emerald-400",
    red: "text-red-700 dark:text-red-400",
    blue: "text-blue-700 dark:text-blue-400",
  }[tone];
  return (
    <div className="mt-1.5">
      <span className={`text-[11px] font-semibold uppercase ${toneClass}`}>
        {label}
      </span>
      <p className="whitespace-pre-wrap text-[13px] leading-snug text-slate-600 dark:text-slate-300">
        {value}
      </p>
    </div>
  );
}

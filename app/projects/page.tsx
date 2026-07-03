import Link from "next/link";
import Header from "@/components/Header";
import ProjectStatusSelect from "@/components/ProjectStatusSelect";
import { requireDbUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PROJECT_STATUS_LABELS } from "@/lib/projects";
import { currentWeekRange } from "@/lib/weeks";

export const dynamic = "force-dynamic";

// Активный проект считаем «без движения», если его не упоминали столько недель.
const STALE_AFTER_WEEKS = 2;

export default async function ProjectsPage() {
  const me = await requireDbUser();
  const isLead = me.role === "LEAD";

  const projects = await prisma.project.findMany({
    orderBy: [{ status: "asc" }, { name: "asc" }],
    include: {
      entries: {
        select: { report: { select: { week: { select: { label: true, startDate: true } } } } },
      },
    },
  });

  const { start: currentStart } = currentWeekRange();
  const weekMs = 7 * 24 * 60 * 60 * 1000;

  const rows = projects.map((p) => {
    const weeks = p.entries
      .map((e) => e.report.week)
      .sort((a, b) => b.startDate.getTime() - a.startDate.getTime());
    const last = weeks[0] ?? null;
    const staleWeeks = last
      ? Math.floor((currentStart.getTime() - last.startDate.getTime()) / weekMs)
      : null;
    return {
      id: p.id,
      name: p.name,
      status: p.status,
      mentions: p.entries.length,
      lastWeekLabel: last?.label ?? null,
      // «нет движения» — только для активных проектов с историей
      staleWeeks:
        p.status === "ACTIVE" && staleWeeks !== null && staleWeeks >= STALE_AFTER_WEEKS
          ? staleWeeks
          : null,
    };
  });

  return (
    <>
      <Header email={me.email} active="projects" isLead={isLead} />
      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
        <div className="mb-5">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
            Проекты
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Все проекты и направления из отчётов: статус, история по неделям,
            AI-статус для отчётности.
          </p>
        </div>

        {rows.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 p-10 text-center text-slate-500 dark:border-slate-700">
            Проектов пока нет — они появятся из отчётов. Если отчёты уже есть,
            запустите <code>npm run db:backfill-projects</code>.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900">
                  <Th>Проект</Th>
                  <Th>Статус</Th>
                  <Th>Упоминаний</Th>
                  <Th>Последний отчёт</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-slate-200 last:border-b-0 dark:border-slate-800"
                  >
                    <td className="p-3">
                      <Link
                        href={`/projects/${p.id}`}
                        className="font-medium text-slate-900 hover:text-blue-700 hover:underline dark:text-white dark:hover:text-blue-300"
                      >
                        {p.name}
                      </Link>
                      {p.staleWeeks !== null && (
                        <span
                          className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                          title="Активный проект давно не упоминался в отчётах"
                        >
                          нет движения {p.staleWeeks} нед.
                        </span>
                      )}
                    </td>
                    <td className="p-3">
                      {isLead ? (
                        <ProjectStatusSelect projectId={p.id} status={p.status} />
                      ) : (
                        <span className="text-slate-600 dark:text-slate-300">
                          {PROJECT_STATUS_LABELS[p.status]}
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-slate-600 dark:text-slate-300">
                      {p.mentions}
                    </td>
                    <td className="p-3 text-slate-600 dark:text-slate-300">
                      {p.lastWeekLabel ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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

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
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            Проекты
          </h1>
          <p className="mt-1 text-sm text-muted">
            Все проекты и направления из отчётов: статус, история по неделям,
            AI-статус для отчётности.
          </p>
        </div>

        {rows.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line-strong p-10 text-center text-muted">
            Проектов пока нет — они появятся из отчётов. Если отчёты уже есть,
            запустите{" "}
            <code className="rounded bg-panel px-1.5 py-0.5 text-[13px]">
              npm run db:backfill-projects
            </code>
            .
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-line-strong">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-panel">
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
                    className="border-b border-line last:border-b-0"
                  >
                    <td className="p-3">
                      <Link
                        href={`/projects/${p.id}`}
                        className="font-medium text-ink hover:text-accent hover:underline"
                      >
                        {p.name}
                      </Link>
                      {p.staleWeeks !== null && (
                        <span
                          className="ml-2 rounded-full bg-warn-bg px-2 py-0.5 text-[11px] font-medium text-warn"
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
                        <span className="text-muted">
                          {PROJECT_STATUS_LABELS[p.status]}
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-muted">{p.mentions}</td>
                    <td className="p-3 text-muted">{p.lastWeekLabel ?? "—"}</td>
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
    <th className="border-b border-line-strong p-3 text-left font-semibold text-ink">
      {children}
    </th>
  );
}

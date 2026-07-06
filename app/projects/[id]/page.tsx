import Link from "next/link";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import ProjectAdminPanel from "@/components/ProjectAdminPanel";
import ProjectStatusSelect from "@/components/ProjectStatusSelect";
import ProjectSummaryPanel from "@/components/ProjectSummaryPanel";
import ColumnChart from "@/components/charts/ColumnChart";
import { requireDbUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PROJECT_STATUS_LABELS } from "@/lib/projects";
import { isoDate, recentWeeks, shortWeekLabel } from "@/lib/weeks";

export const dynamic = "force-dynamic";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const me = await requireDbUser();
  const isLead = me.role === "LEAD";
  const { id } = await params;

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      entries: {
        include: { report: { include: { user: true, week: true } } },
      },
    },
  });
  if (!project) notFound();

  const otherProjects = isLead
    ? await prisma.project.findMany({
        where: { NOT: { id } },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      })
    : [];

  // История по неделям, новые сверху.
  const byWeek = new Map<
    string,
    {
      startDate: Date;
      label: string;
      entries: (typeof project.entries)[number][];
    }
  >();
  for (const e of project.entries) {
    const w = e.report.week;
    const group =
      byWeek.get(w.id) ?? { startDate: w.startDate, label: w.label, entries: [] };
    group.entries.push(e);
    byWeek.set(w.id, group);
  }
  const weeks = [...byWeek.values()].sort(
    (a, b) => b.startDate.getTime() - a.startDate.getTime(),
  );

  // Активность за последние 12 недель (число упоминаний по неделям, старые → новые).
  const activity = recentWeeks(12)
    .reverse()
    .map((w) => {
      const key = isoDate(w.start);
      const count = project.entries.filter(
        (e) => isoDate(e.report.week.startDate) === key,
      ).length;
      return { label: w.label, short: shortWeekLabel(w.label), value: count };
    });
  const hasActivity = activity.some((p) => p.value > 0);

  return (
    <>
      <Header email={me.email} active="projects" isLead={isLead} />
      <main className="viz-root mx-auto max-w-4xl px-4 py-6 sm:px-6">
        <div className="mb-5">
          <Link
            href="/projects"
            className="text-sm text-muted transition hover:text-ink"
          >
            ← Все проекты
          </Link>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-ink">
              {project.name}
            </h1>
            {isLead ? (
              <ProjectStatusSelect projectId={project.id} status={project.status} />
            ) : (
              <span className="rounded-full bg-panel px-3 py-1.5 text-sm text-muted">
                {PROJECT_STATUS_LABELS[project.status]}
              </span>
            )}
          </div>
        </div>

        <div className="mb-6 space-y-4">
          <ProjectSummaryPanel
            projectId={project.id}
            initialContent={project.aiSummary}
            initialGeneratedAt={
              project.aiSummaryAt
                ? project.aiSummaryAt.toLocaleDateString("ru-RU")
                : null
            }
            hasEntries={project.entries.length > 0}
          />
          {isLead && (
            <ProjectAdminPanel
              projectId={project.id}
              projectName={project.name}
              otherProjects={otherProjects}
            />
          )}
          {hasActivity && (
            <section className="card p-5">
              <h2 className="font-medium text-ink">Активность за 12 недель</h2>
              <p className="mb-4 mt-0.5 text-xs text-muted">
                Число упоминаний проекта в отчётах по неделям
              </p>
              <ColumnChart
                data={activity}
                unit="упоминаний"
                tableCaption={`Упоминания проекта «${project.name}» по неделям`}
              />
            </section>
          )}
        </div>

        <h2 className="mb-3 font-semibold text-ink">История по неделям</h2>
        {weeks.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line-strong p-8 text-center text-muted">
            Проект ещё не упоминался в отчётах.
          </p>
        ) : (
          <div className="space-y-4">
            {weeks.map((w) => (
              <div
                key={w.label + w.startDate.toISOString()}
                className="card p-5"
              >
                <p className="mb-3 font-medium text-ink">{w.label}</p>
                <div className="space-y-3">
                  {w.entries.map((e) => (
                    <div key={e.id} className="rounded-lg bg-panel p-3">
                      <p className="text-xs font-medium text-muted">
                        {e.report.user.name ?? e.report.user.email}
                      </p>
                      <Section label="Сделано" value={e.done} tone="success" />
                      <Section label="Блокеры" value={e.blockers} tone="danger" />
                      <Section label="Планы" value={e.plans} tone="warn" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  );
}

function Section({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "success" | "danger" | "warn";
}) {
  if (!value.trim()) return null;
  const toneClass = {
    success: "text-success",
    danger: "text-danger",
    warn: "text-warn",
  }[tone];
  return (
    <div className="mt-1.5">
      <span className={`text-[11px] font-semibold uppercase ${toneClass}`}>
        {label}
      </span>
      <p className="whitespace-pre-wrap text-[13px] leading-snug text-muted">
        {value}
      </p>
    </div>
  );
}

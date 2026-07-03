import Link from "next/link";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import ProjectStatusSelect from "@/components/ProjectStatusSelect";
import ProjectSummaryPanel from "@/components/ProjectSummaryPanel";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const me = await requireUser();
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

  return (
    <>
      <Header email={me.email} active="projects" />
      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
        <div className="mb-5">
          <Link
            href="/projects"
            className="text-sm text-blue-600 hover:underline dark:text-blue-400"
          >
            ← Все проекты
          </Link>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
              {project.name}
            </h1>
            <ProjectStatusSelect projectId={project.id} status={project.status} />
          </div>
        </div>

        <div className="mb-6">
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
        </div>

        <h2 className="mb-3 font-semibold text-slate-900 dark:text-white">
          История по неделям
        </h2>
        {weeks.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500 dark:border-slate-700">
            Проект ещё не упоминался в отчётах.
          </p>
        ) : (
          <div className="space-y-4">
            {weeks.map((w) => (
              <div
                key={w.label + w.startDate.toISOString()}
                className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
              >
                <p className="mb-3 font-medium text-slate-900 dark:text-white">
                  {w.label}
                </p>
                <div className="space-y-3">
                  {w.entries.map((e) => (
                    <div
                      key={e.id}
                      className="rounded-lg bg-slate-50 p-3 dark:bg-slate-950"
                    >
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                        {e.report.user.name ?? e.report.user.email}
                      </p>
                      <Section label="Сделано" value={e.done} tone="emerald" />
                      <Section label="Блокеры" value={e.blockers} tone="red" />
                      <Section label="Планы" value={e.plans} tone="blue" />
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

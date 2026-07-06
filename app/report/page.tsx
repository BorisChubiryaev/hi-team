import Link from "next/link";
import Header from "@/components/Header";
import ReportForm from "@/components/ReportForm";
import { requireDbUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { EDITABLE_WEEKS, isoDate, recentWeeks } from "@/lib/weeks";
import type { ProjectInput } from "@/app/report/actions";

export default async function ReportPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const user = await requireDbUser();

  const weeks = recentWeeks(EDITABLE_WEEKS);
  const params = await searchParams;
  const requested = Array.isArray(params.week) ? params.week[0] : params.week;
  const selected =
    weeks.find((w) => isoDate(w.start) === requested) ?? weeks[0];
  const selectedIso = isoDate(selected.start);
  const isCurrent = selectedIso === isoDate(weeks[0].start);

  const week = await prisma.week.findUnique({
    where: { startDate: selected.start },
  });

  const report = week
    ? await prisma.report.findUnique({
        where: { userId_weekId: { userId: user.id, weekId: week.id } },
        include: { projects: { orderBy: { order: "asc" } } },
      })
    : null;

  let initialProjects: ProjectInput[] =
    report?.projects.map((p) => ({
      name: p.name,
      done: p.done,
      blockers: p.blockers,
      plans: p.plans,
    })) ?? [];

  // Черновик: если отчёт за выбранную неделю ещё не создан, предзаполняем его
  // из последнего отчёта до неё — планы становятся заготовкой «Сделано»,
  // блокеры переносятся.
  let draftFromLabel: string | null = null;
  if (!report) {
    const previous = await prisma.report.findFirst({
      where: { userId: user.id, week: { startDate: { lt: selected.start } } },
      orderBy: { week: { startDate: "desc" } },
      include: {
        week: true,
        projects: { orderBy: { order: "asc" } },
      },
    });
    if (previous && previous.projects.length > 0) {
      draftFromLabel = previous.week.label;
      initialProjects = previous.projects.map((p) => ({
        name: p.name,
        done: p.plans,
        blockers: p.blockers,
        plans: "",
      }));
    }
  }

  // Имена активных проектов для автодополнения в форме.
  const projectNames = (
    await prisma.project.findMany({
      where: { status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { name: true },
    })
  ).map((p) => p.name);

  return (
    <>
      <Header
        email={user.email}
        active="report"
        isLead={user.role === "LEAD"}
      />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            Мой отчёт
          </h1>
          <p className="mt-1 text-sm text-muted">
            Неделя {selected.label}
            {isCurrent ? " (текущая)" : ""}. Для каждого проекта заполните, что
            сделано, какие блокеры и планы.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {weeks.map((w, i) => {
              const iso = isoDate(w.start);
              const activeTab = iso === selectedIso;
              return (
                <Link
                  key={iso}
                  href={i === 0 ? "/report" : `/report?week=${iso}`}
                  className={`rounded-full px-3 py-1.5 text-sm transition ${
                    activeTab
                      ? "bg-ink font-medium text-card"
                      : "border border-line bg-card text-muted hover:bg-panel hover:text-ink"
                  }`}
                >
                  {w.label}
                </Link>
              );
            })}
          </div>
        </div>
        <ReportForm
          key={selectedIso}
          weekStartIso={selectedIso}
          initialProjects={initialProjects}
          projectNames={projectNames}
          draftFromLabel={draftFromLabel}
        />
      </main>
    </>
  );
}

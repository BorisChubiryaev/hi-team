import Link from "next/link";
import Header from "@/components/Header";
import ReportForm from "@/components/ReportForm";
import { requireDirector } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { EDITABLE_WEEKS, isoDate, recentWeeks } from "@/lib/weeks";
import type { ProjectInput } from "@/lib/reports";
import { saveMyDirectorReport } from "./actions";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Мои отчёты — hi-team",
};

export default async function DirectorPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // Раздел доступен только руководителю; остальных requireDirector уводит на дашборд.
  const user = await requireDirector();

  const weeks = recentWeeks(EDITABLE_WEEKS);
  const params = await searchParams;
  const requested = Array.isArray(params.week) ? params.week[0] : params.week;
  const selected = weeks.find((w) => isoDate(w.start) === requested) ?? weeks[0];
  const selectedIso = isoDate(selected.start);
  const isCurrent = selectedIso === isoDate(weeks[0].start);

  const week = await prisma.week.findUnique({
    where: { startDate: selected.start },
  });

  const report = week
    ? await prisma.directorReport.findUnique({
        where: { authorId_weekId: { authorId: user.id, weekId: week.id } },
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

  // Черновик: если за выбранную неделю отчёта ещё нет — предзаполняем из
  // предыдущего (планы → заготовка «Сделано», блокеры переносятся).
  let draftFromLabel: string | null = null;
  if (!report) {
    const previous = await prisma.directorReport.findFirst({
      where: {
        authorId: user.id,
        week: { startDate: { lt: selected.start } },
      },
      orderBy: { week: { startDate: "desc" } },
      include: { week: true, projects: { orderBy: { order: "asc" } } },
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

  return (
    <>
      <Header email={user.email} active="director" role={user.role} />
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            Мои отчёты
          </h1>
          <p className="mt-1 text-sm text-muted">
            Личный раздел руководителя. Неделя {selected.label}
            {isCurrent ? " (текущая)" : ""}. Виден только вам — в командный
            дашборд, сводки и экспорт не попадает.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {weeks.map((w, i) => {
              const iso = isoDate(w.start);
              const activeTab = iso === selectedIso;
              return (
                <Link
                  key={iso}
                  href={i === 0 ? "/director" : `/director?week=${iso}`}
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
          draftFromLabel={draftFromLabel}
          save={saveMyDirectorReport}
        />
      </main>
    </>
  );
}

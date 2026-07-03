import Header from "@/components/Header";
import ReportForm from "@/components/ReportForm";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { currentWeekRange, formatWeekLabel } from "@/lib/weeks";
import type { ProjectInput } from "@/app/report/actions";

export default async function ReportPage() {
  const user = await requireUser();
  const { start, end } = currentWeekRange();
  const label = formatWeekLabel(start, end);

  const week = await prisma.week.findUnique({
    where: { startDate: start },
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

  // Черновик: если отчёт за текущую неделю ещё не создан, предзаполняем его
  // из прошлого отчёта — планы становятся заготовкой «Сделано», блокеры переносятся.
  let draftFromLabel: string | null = null;
  if (!report) {
    const previous = await prisma.report.findFirst({
      where: { userId: user.id, week: { startDate: { lt: start } } },
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
      <Header email={user.email} active="report" />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
            Мой отчёт
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Неделя {label}. Для каждого проекта заполните, что сделано, какие
            блокеры и планы.
          </p>
        </div>
        <ReportForm
          initialProjects={initialProjects}
          projectNames={projectNames}
          draftFromLabel={draftFromLabel}
        />
      </main>
    </>
  );
}

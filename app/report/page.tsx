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

  const initialProjects: ProjectInput[] =
    report?.projects.map((p) => ({
      name: p.name,
      done: p.done,
      blockers: p.blockers,
      plans: p.plans,
    })) ?? [];

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
        <ReportForm initialProjects={initialProjects} />
      </main>
    </>
  );
}

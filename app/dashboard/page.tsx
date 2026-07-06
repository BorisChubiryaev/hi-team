import Link from "next/link";
import Header from "@/components/Header";
import SummaryCell from "@/components/SummaryCell";
import { requireDbUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { currentWeekRange } from "@/lib/weeks";

export const dynamic = "force-dynamic";

const DEFAULT_WEEKS_LIMIT = 8;

function displayName(user: { name: string | null; email: string }) {
  return user.name ?? user.email.split("@")[0];
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const me = await requireDbUser();

  const params = await searchParams;
  const rawLimit = Number(
    Array.isArray(params.limit) ? params.limit[0] : params.limit,
  );
  const limit =
    Number.isFinite(rawLimit) && rawLimit > 0
      ? Math.floor(rawLimit)
      : DEFAULT_WEEKS_LIMIT;

  const { start } = currentWeekRange();

  const [users, weeks, totalWeeks, currentWeek] = await Promise.all([
    prisma.user.findMany({
      where: { active: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.week.findMany({
      orderBy: { startDate: "desc" },
      take: limit,
      include: {
        summary: true,
        reports: { include: { projects: { orderBy: { order: "asc" } } } },
      },
    }),
    prisma.week.count(),
    prisma.week.findUnique({
      where: { startDate: start },
      include: { reports: { include: { projects: true } } },
    }),
  ]);

  // Кто ещё не сдал отчёт за текущую неделю.
  const submitted = new Set(
    (currentWeek?.reports ?? [])
      .filter((r) => r.projects.length > 0)
      .map((r) => r.userId),
  );
  const missing = users.filter((u) => !submitted.has(u.id));

  // weekId -> userId -> projects
  const byWeekUser = new Map<string, Map<string, (typeof weeks)[number]["reports"][number]["projects"]>>();
  for (const w of weeks) {
    const m = new Map<string, (typeof weeks)[number]["reports"][number]["projects"]>();
    for (const r of w.reports) m.set(r.userId, r.projects);
    byWeekUser.set(w.id, m);
  }

  return (
    <>
      <Header
        email={me.email}
        active="dashboard"
        isLead={me.role === "LEAD"}
      />
      <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-ink">
              Еженедельные отчёты
            </h1>
            <p className="mt-1 text-sm text-muted">
              Недели по строкам, сотрудники по столбцам. Последняя колонка —
              AI-сводка для руководителя.
            </p>
          </div>
          <Link href="/report" className="btn btn-primary">
            Заполнить мой отчёт
          </Link>
        </div>

        {missing.length > 0 && (
          <p className="mb-5 rounded-lg border border-warn/25 bg-warn-bg px-4 py-3 text-sm text-warn">
            Ещё не сдали отчёт за текущую неделю:{" "}
            <span className="font-medium">
              {missing.map((u) => displayName(u)).join(", ")}
            </span>
          </p>
        )}

        {weeks.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line-strong p-10 text-center text-muted">
            Пока нет ни одного отчёта.{" "}
            <Link href="/report" className="link">
              Создайте первый
            </Link>
            .
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-line-strong">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-panel">
                  <th className="sticky left-0 z-10 min-w-[110px] border-b border-r border-line-strong bg-panel p-3 text-left font-semibold text-ink">
                    Неделя
                  </th>
                  {users.map((u) => (
                    <th
                      key={u.id}
                      className="min-w-[260px] border-b border-r border-line-strong p-3 text-left font-semibold text-ink"
                    >
                      {displayName(u)}
                    </th>
                  ))}
                  <th className="min-w-[300px] border-b border-line-strong bg-cream/50 p-3 text-left font-semibold text-cream-ink">
                    AI Суммаризатор
                  </th>
                </tr>
              </thead>
              <tbody>
                {weeks.map((w) => {
                  const userMap = byWeekUser.get(w.id)!;
                  return (
                    <tr key={w.id} className="align-top">
                      <th className="sticky left-0 z-10 border-b border-r border-line-strong bg-card p-3 text-left align-top font-medium text-ink">
                        {w.label}
                        <a
                          href={`/api/export?weekId=${w.id}`}
                          className="mt-1 block text-xs font-normal text-accent hover:underline"
                          title="Скачать неделю в Markdown"
                        >
                          Экспорт .md
                        </a>
                      </th>
                      {users.map((u) => {
                        const projects = userMap.get(u.id);
                        return (
                          <td
                            key={u.id}
                            className="border-b border-r border-line-strong p-3 align-top"
                          >
                            {projects && projects.length > 0 ? (
                              <div className="space-y-3">
                                {projects.map((p) => (
                                  <ProjectBlock key={p.id} project={p} />
                                ))}
                              </div>
                            ) : (
                              <span className="text-faint">—</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="border-b border-line-strong bg-cream/25 p-3 align-top">
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

        {totalWeeks > weeks.length && (
          <div className="mt-4 text-center">
            <Link
              href={`/dashboard?limit=${limit + DEFAULT_WEEKS_LIMIT}`}
              className="btn btn-ghost"
            >
              Показать ещё ({weeks.length} из {totalWeeks} недель)
            </Link>
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
    projectId: string | null;
    name: string;
    done: string;
    blockers: string;
    plans: string;
  };
}) {
  return (
    <div className="rounded-lg bg-panel p-2.5">
      {project.name &&
        (project.projectId ? (
          <Link
            href={`/projects/${project.projectId}`}
            className="font-medium text-ink hover:text-accent hover:underline"
          >
            {project.name}
          </Link>
        ) : (
          <p className="font-medium text-ink">{project.name}</p>
        ))}
      <Section label="Сделано" value={project.done} tone="success" />
      <Section label="Блокеры" value={project.blockers} tone="danger" />
      <Section label="Планы" value={project.plans} tone="warn" />
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

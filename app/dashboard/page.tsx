import Link from "next/link";
import Header from "@/components/Header";
import SummaryCell from "@/components/SummaryCell";
import { requireDbUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { currentWeekRange } from "@/lib/weeks";

export const dynamic = "force-dynamic";

const DEFAULT_WEEKS_LIMIT = 8;

type UserLite = { id: string; name: string | null; email: string };
type ProjectRow = {
  id: string;
  projectId: string | null;
  name: string;
  done: string;
  blockers: string;
  plans: string;
};

function displayName(user: { name: string | null; email: string }) {
  return user.name ?? user.email.split("@")[0];
}

function firstParam(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const me = await requireDbUser();

  const params = await searchParams;
  const rawLimit = Number(firstParam(params.limit));
  const limit =
    Number.isFinite(rawLimit) && rawLimit > 0
      ? Math.floor(rawLimit)
      : DEFAULT_WEEKS_LIMIT;
  const view = firstParam(params.view) === "table" ? "table" : "feed";

  const { start } = currentWeekRange();

  const [users, weeks, totalWeeks, currentWeek] = await Promise.all([
    // Колонки — только те, от кого ждём отчёт (Руководитель не пишет отчёты).
    prisma.user.findMany({
      where: { active: true, role: { not: "DIRECTOR" } },
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
  const byWeekUser = new Map<string, Map<string, ProjectRow[]>>();
  for (const w of weeks) {
    const m = new Map<string, ProjectRow[]>();
    for (const r of w.reports) m.set(r.userId, r.projects);
    byWeekUser.set(w.id, m);
  }

  const viewHref = (v: "feed" | "table") => {
    const qs = new URLSearchParams();
    if (v === "table") qs.set("view", "table");
    if (limit !== DEFAULT_WEEKS_LIMIT) qs.set("limit", String(limit));
    const s = qs.toString();
    return s ? `/dashboard?${s}` : "/dashboard";
  };
  const moreHref = () => {
    const qs = new URLSearchParams();
    if (view === "table") qs.set("view", "table");
    qs.set("limit", String(limit + DEFAULT_WEEKS_LIMIT));
    return `/dashboard?${qs.toString()}`;
  };

  return (
    <>
      <Header email={me.email} active="dashboard" role={me.role} />
      <main className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-ink">
              Еженедельные отчёты
            </h1>
            <p className="mt-1 text-sm text-muted">
              Свежая неделя раскрыта: AI-сводка, кто сдал и что сделано по
              проектам.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-full border border-line bg-card p-0.5">
              <ViewTab href={viewHref("feed")} active={view === "feed"}>
                Лента
              </ViewTab>
              <ViewTab href={viewHref("table")} active={view === "table"}>
                Таблица
              </ViewTab>
            </div>
            <Link href="/report" className="btn btn-primary">
              Заполнить мой отчёт
            </Link>
          </div>
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
        ) : view === "feed" ? (
          <div className="space-y-4">
            {weeks.map((w, i) => {
              const userMap = byWeekUser.get(w.id)!;
              const submittedUsers = users.filter(
                (u) => (userMap.get(u.id)?.length ?? 0) > 0,
              );
              const missingUsers = users.filter(
                (u) => (userMap.get(u.id)?.length ?? 0) === 0,
              );
              const blockersCount = w.reports.reduce(
                (acc, r) =>
                  acc + r.projects.filter((p) => p.blockers.trim()).length,
                0,
              );
              return (
                <details
                  key={w.id}
                  open={i === 0}
                  className="overflow-hidden rounded-xl border border-line bg-card shadow-[var(--shadow-soft)]"
                >
                  <summary className="flex cursor-pointer list-none items-center gap-3 p-4">
                    <Chevron />
                    <div className="min-w-0">
                      <p className="font-semibold text-ink">{w.label}</p>
                      <p className="mt-0.5 text-xs text-muted">
                        сдали {submittedUsers.length}/{users.length}
                        {blockersCount > 0 && (
                          <>
                            {" · "}
                            <span className="text-danger">
                              блокеров {blockersCount}
                            </span>
                          </>
                        )}
                      </p>
                    </div>
                    <a
                      href={`/api/export?weekId=${w.id}`}
                      className="ml-auto shrink-0 text-xs font-medium text-accent hover:underline"
                      title="Скачать неделю в Markdown"
                    >
                      Экспорт .md
                    </a>
                  </summary>

                  <div className="space-y-4 border-t border-line p-4">
                    <div className="rounded-xl border border-cream-ink/15 bg-cream/50 p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-cream-ink">
                        AI-сводка недели
                      </p>
                      <div className="mt-2">
                        <SummaryCell
                          weekId={w.id}
                          initialContent={w.summary?.content ?? null}
                          initialModel={w.summary?.model ?? null}
                          hasReports={w.reports.length > 0}
                        />
                      </div>
                    </div>

                    {missingUsers.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-xs text-muted">Не сдали:</span>
                        {missingUsers.map((u) => (
                          <span
                            key={u.id}
                            className="rounded-full bg-panel px-2 py-0.5 text-xs text-muted"
                          >
                            {displayName(u)}
                          </span>
                        ))}
                      </div>
                    )}

                    {submittedUsers.length === 0 ? (
                      <p className="text-sm text-faint">
                        За эту неделю ещё нет отчётов.
                      </p>
                    ) : (
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {submittedUsers.map((u) => (
                          <PersonCard
                            key={u.id}
                            name={displayName(u)}
                            projects={userMap.get(u.id) ?? []}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </details>
              );
            })}
          </div>
        ) : (
          <TableView users={users} weeks={weeks} byWeekUser={byWeekUser} />
        )}

        {totalWeeks > weeks.length && (
          <div className="mt-4 text-center">
            <Link href={moreHref()} className="btn btn-ghost">
              Показать ещё ({weeks.length} из {totalWeeks} недель)
            </Link>
          </div>
        )}
      </main>
    </>
  );
}

function ViewTab({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`rounded-full px-3 py-1 text-sm transition ${
        active
          ? "bg-ink font-medium text-card"
          : "text-muted hover:text-ink"
      }`}
    >
      {children}
    </Link>
  );
}

function Chevron() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="feed-chevron size-4 shrink-0 text-faint"
      aria-hidden="true"
    >
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

// Тёплая палитра аватаров (белый текст читается на каждом).
const AVATAR_COLORS = [
  "#e8590c",
  "#d9480f",
  "#c2410c",
  "#b45309",
  "#a16207",
  "#15803d",
  "#0f766e",
  "#9a3412",
];
function avatarColor(key: string) {
  let h = 0;
  for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}
function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

function PersonCard({
  name,
  projects,
}: {
  name: string;
  projects: ProjectRow[];
}) {
  return (
    <div className="rounded-xl border border-line bg-card p-3">
      <div className="flex items-center gap-2">
        <span
          className="flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
          style={{ background: avatarColor(name) }}
          aria-hidden="true"
        >
          {initials(name)}
        </span>
        <p className="truncate text-sm font-semibold text-ink">{name}</p>
      </div>
      <div className="mt-2 space-y-2">
        {projects.map((p) => (
          <ProjectBlock key={p.id} project={p} />
        ))}
      </div>
    </div>
  );
}

function TableView({
  users,
  weeks,
  byWeekUser,
}: {
  users: UserLite[];
  weeks: {
    id: string;
    label: string;
    summary: { content: string; model: string } | null;
    reports: { id: string }[];
  }[];
  byWeekUser: Map<string, Map<string, ProjectRow[]>>;
}) {
  return (
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
  );
}

function ProjectBlock({ project }: { project: ProjectRow }) {
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

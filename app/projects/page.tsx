import Link from "next/link";
import type { ProjectStatus } from "@prisma/client";
import Header from "@/components/Header";
import ProjectStatusSelect from "@/components/ProjectStatusSelect";
import { requireDbUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PROJECT_STATUS_LABELS } from "@/lib/projects";
import { currentWeekRange } from "@/lib/weeks";

export const dynamic = "force-dynamic";

// Активный проект считаем «без движения», если его не упоминали столько недель.
const STALE_AFTER_WEEKS = 2;

type SortKey = "name" | "mentions" | "recent";

const STATUS_FILTERS: { key: string; label: string }[] = [
  { key: "all", label: "Все" },
  { key: "ACTIVE", label: "Активные" },
  { key: "PAUSED", label: "На паузе" },
  { key: "DONE", label: "Завершённые" },
];

const VALID_STATUSES: ProjectStatus[] = ["ACTIVE", "PAUSED", "DONE"];

function firstParam(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const me = await requireDbUser();
  const isLead = me.role === "LEAD";

  const params = await searchParams;
  const statusFilter = firstParam(params.status) ?? "all";
  const sort = (firstParam(params.sort) ?? "name") as SortKey;
  const dir = firstParam(params.dir) === "desc" ? "desc" : "asc";

  const projects = await prisma.project.findMany({
    orderBy: [{ status: "asc" }, { name: "asc" }],
    include: {
      entries: {
        select: {
          report: { select: { week: { select: { label: true, startDate: true } } } },
        },
      },
    },
  });

  const { start: currentStart } = currentWeekRange();
  const weekMs = 7 * 24 * 60 * 60 * 1000;

  let rows = projects.map((p) => {
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
      lastStart: last?.startDate ?? null,
      staleWeeks:
        p.status === "ACTIVE" && staleWeeks !== null && staleWeeks >= STALE_AFTER_WEEKS
          ? staleWeeks
          : null,
    };
  });

  // Фильтр по статусу.
  if (VALID_STATUSES.includes(statusFilter as ProjectStatus)) {
    rows = rows.filter((r) => r.status === statusFilter);
  }

  // Сортировка.
  const factor = dir === "asc" ? 1 : -1;
  rows.sort((a, b) => {
    let cmp = 0;
    if (sort === "mentions") cmp = a.mentions - b.mentions;
    else if (sort === "recent") {
      cmp = (a.lastStart?.getTime() ?? 0) - (b.lastStart?.getTime() ?? 0);
    } else cmp = a.name.localeCompare(b.name, "ru");
    return cmp * factor;
  });

  // Счётчики для фильтра-пилюль.
  const counts: Record<string, number> = {
    all: projects.length,
    ACTIVE: projects.filter((p) => p.status === "ACTIVE").length,
    PAUSED: projects.filter((p) => p.status === "PAUSED").length,
    DONE: projects.filter((p) => p.status === "DONE").length,
  };

  const buildHref = (next: Record<string, string | undefined>) => {
    const merged = { status: statusFilter, sort, dir, ...next };
    const qs = new URLSearchParams();
    if (merged.status && merged.status !== "all") qs.set("status", merged.status);
    if (merged.sort && merged.sort !== "name") qs.set("sort", merged.sort);
    if (merged.dir && merged.dir !== "asc") qs.set("dir", merged.dir);
    const s = qs.toString();
    return s ? `/projects?${s}` : "/projects";
  };

  const sortHref = (key: SortKey) => {
    const nextDir = sort === key && dir === "asc" ? "desc" : "asc";
    return buildHref({ sort: key, dir: nextDir });
  };
  const arrow = (key: SortKey) =>
    sort === key ? (dir === "asc" ? " ↑" : " ↓") : "";

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

        {projects.length > 0 && (
          <div className="mb-4 flex flex-wrap items-center gap-1.5">
            {STATUS_FILTERS.map((f) => {
              const activeFilter =
                statusFilter === f.key || (f.key === "all" && statusFilter === "all");
              return (
                <Link
                  key={f.key}
                  href={buildHref({ status: f.key })}
                  className={`rounded-full px-3 py-1.5 text-sm transition ${
                    activeFilter
                      ? "bg-ink font-medium text-card"
                      : "border border-line bg-card text-muted hover:bg-panel hover:text-ink"
                  }`}
                >
                  {f.label}
                  <span
                    className={activeFilter ? "text-card/60" : "text-faint"}
                  >
                    {" "}
                    {counts[f.key] ?? 0}
                  </span>
                </Link>
              );
            })}
          </div>
        )}

        {projects.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line-strong p-10 text-center text-muted">
            Проектов пока нет — они появятся из отчётов. Если отчёты уже есть,
            запустите{" "}
            <code className="rounded bg-panel px-1.5 py-0.5 text-[13px]">
              npm run db:backfill-projects
            </code>
            .
          </p>
        ) : rows.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line-strong p-10 text-center text-muted">
            Нет проектов с выбранным статусом.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-line-strong">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-panel">
                  <Th href={sortHref("name")}>Проект{arrow("name")}</Th>
                  <Th>Статус</Th>
                  <Th href={sortHref("mentions")}>
                    Упоминаний{arrow("mentions")}
                  </Th>
                  <Th href={sortHref("recent")}>
                    Последний отчёт{arrow("recent")}
                  </Th>
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

function Th({
  children,
  href,
}: {
  children: React.ReactNode;
  href?: string;
}) {
  return (
    <th className="border-b border-line-strong p-3 text-left font-semibold text-ink">
      {href ? (
        <Link href={href} className="transition hover:text-accent">
          {children}
        </Link>
      ) : (
        children
      )}
    </th>
  );
}

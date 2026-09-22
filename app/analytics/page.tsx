import Header from "@/components/Header";
import AnalyticsFilters from "@/components/AnalyticsFilters";
import ColumnChart from "@/components/charts/ColumnChart";
import HBarChart from "@/components/charts/HBarChart";
import Heatmap from "@/components/charts/Heatmap";
import DirectorQuarterReviews, {
  type EmployeeReview,
} from "@/components/DirectorQuarterReviews";
import { getAnalytics } from "@/lib/analytics";
// (подкоманды теперь на команду — валидируются по options из getAnalytics)
import { requireDbUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parseQuarterKey, recentQuarters } from "@/lib/periods";
import { shortWeekLabel } from "@/lib/weeks";
import type { ProjectStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

const DEFAULT_WEEKS = 12;
const VALID_STATUSES: ProjectStatus[] = ["ACTIVE", "PAUSED", "DONE"];

function firstParam(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const me = await requireDbUser();

  const params = await searchParams;
  const all = firstParam(params.all) === "1";
  const weeksRaw = Number(firstParam(params.weeks));
  const weeks =
    Number.isFinite(weeksRaw) && weeksRaw > 0
      ? Math.min(520, Math.floor(weeksRaw))
      : DEFAULT_WEEKS;
  const userId = firstParam(params.user) || undefined;
  const projectId = firstParam(params.project) || undefined;
  const statusRaw = firstParam(params.status);
  const status = VALID_STATUSES.includes(statusRaw as ProjectStatus)
    ? (statusRaw as ProjectStatus)
    : undefined;
  const subteamId = firstParam(params.subteam) || undefined;

  const a = await getAnalytics({
    workspaceId: me.workspaceId,
    weeksLimit: all ? 0 : weeks,
    userId,
    projectId,
    status,
    subteamId,
  });
  const withShort = (points: { label: string; value: number }[]) =>
    points.map((p) => ({ ...p, short: shortWeekLabel(p.label) }));

  // Раздел только для роли «Руководитель»: квартальные резюме сотрудников к
  // встрече 1:1. Собираем данные лишь для DIRECTOR, чтобы не грузить остальных.
  let director: {
    periodLabel: string;
    quarters: { key: string; label: string; href: string; active: boolean }[];
    employees: EmployeeReview[];
  } | null = null;

  if (me.role === "DIRECTOR") {
    const quarters = recentQuarters(6);
    const rq = firstParam(params.rq);
    const selected = (rq && parseQuarterKey(rq)) || quarters[0];

    const buildHref = (key: string) => {
      const qs = new URLSearchParams();
      for (const [k, v] of Object.entries(params)) {
        const val = firstParam(v);
        if (val && k !== "rq") qs.set(k, val);
      }
      qs.set("rq", key);
      return `/analytics?${qs.toString()}`;
    };

    const [members, preps] = await Promise.all([
      prisma.user.findMany({
        where: {
          workspaceId: me.workspaceId,
          active: true,
          role: { not: "DIRECTOR" }, // руководители отчёты/резюме не пишут
        },
        orderBy: [{ name: "asc" }],
        select: {
          id: true,
          name: true,
          email: true,
          subteam: { select: { key: true } },
        },
      }),
      prisma.reviewPrep.findMany({
        where: {
          periodStart: selected.start,
          periodEnd: selected.end,
          user: { workspaceId: me.workspaceId },
        },
        select: {
          userId: true,
          content: true,
          focus: true,
          updatedAt: true,
        },
      }),
    ]);

    const prepByUser = new Map(preps.map((p) => [p.userId, p]));
    const employees: EmployeeReview[] = members.map((m) => {
      const prep = prepByUser.get(m.id);
      return {
        id: m.id,
        name: m.name ?? m.email,
        subteamKey: m.subteam?.key ?? null,
        hasPrep: Boolean(prep),
        content: prep?.content ?? "",
        focus: prep?.focus ?? null,
        updatedAt: prep
          ? new Date(prep.updatedAt).toLocaleDateString("ru-RU")
          : "",
      };
    });
    // Сначала — у кого готово, затем по имени (порядок уже по имени из БД).
    employees.sort((x, y) => Number(y.hasPrep) - Number(x.hasPrep));

    director = {
      periodLabel: selected.label,
      quarters: quarters.map((q) => ({
        key: q.key,
        label: q.label,
        href: buildHref(q.key),
        active: q.key === selected.key,
      })),
      employees,
    };
  }

  return (
    <>
      <Header
        email={me.email}
        active="analytics"
        role={me.role}
        isSuperAdmin={me.isSuperAdmin}
      />
      <main className="viz-root mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <div className="mb-5">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            Аналитика
          </h1>
          <p className="mt-1 text-sm text-muted">
            Дисциплина сдачи, динамика блокеров и активность по проектам.
          </p>
        </div>

        {/* KPI — текущее состояние */}
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile
            label="Сдано на этой неделе"
            value={`${a.tiles.submittedThisWeek} из ${a.tiles.teamSize}`}
          />
          <StatTile
            label="Блокеров на прошлой неделе"
            value={String(a.tiles.blockersLastWeek)}
          />
          <StatTile
            label="Активных проектов"
            value={String(a.tiles.activeProjects)}
            note={`на паузе ${a.tiles.pausedProjects} · завершено ${a.tiles.doneProjects}`}
          />
          <StatTile
            label="Недель с отчётами"
            value={String(a.tiles.totalWeeks)}
          />
        </div>

        {/* Сдача в разрезе подкоманд за текущую неделю */}
        {a.subteamBreakdown.length > 0 && (
          <div className="mb-6">
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-faint">
              Сдача по подкомандам · эта неделя
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {a.subteamBreakdown.map((b) => (
                <div
                  key={b.key}
                  className="card flex items-center justify-between p-4"
                >
                  <span className="rounded-full bg-cream px-2.5 py-0.5 font-mono text-xs font-medium text-cream-ink">
                    {b.label}
                  </span>
                  <span className="text-xl font-semibold tabular-nums text-ink">
                    {b.submitted} / {b.size}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Фильтры — скоупят все графики ниже */}
        <AnalyticsFilters
          users={a.options.users}
          projects={a.options.projects}
          weeks={weeks}
          all={all}
          userId={userId}
          projectId={projectId}
          status={status}
          subteams={a.options.subteams}
          subteamId={subteamId}
        />

        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard
            title="Сдача отчётов по неделям"
            subtitle={`Сколько человек из ${a.teamSize} сдали отчёт`}
          >
            <ColumnChart
              data={withShort(a.discipline)}
              maxValue={a.teamSize}
              unit="отчётов"
              tableCaption="Сдано отчётов по неделям"
            />
          </ChartCard>

          <ChartCard
            title="Блокеры по неделям"
            subtitle="Записей с непустыми блокерами в отчётах"
          >
            <ColumnChart
              data={withShort(a.blockers)}
              unit="блокеров"
              tableCaption="Блокеры по неделям"
            />
          </ChartCard>

          <ChartCard
            title="Топ проектов по упоминаниям"
            subtitle="За выбранный период; клик — страница проекта"
            wide
          >
            {a.topProjects.length === 0 ? (
              <EmptyNote />
            ) : (
              <HBarChart
                data={a.topProjects.map((p) => ({
                  id: p.id,
                  name: p.name,
                  value: p.mentions,
                }))}
                unit="упоминаний"
              />
            )}
          </ChartCard>

          <ChartCard
            title="Активность по проектам"
            subtitle="Сколько человек упоминали проект в каждую неделю"
            wide
          >
            {a.heatmap.rows.length === 0 ? (
              <EmptyNote />
            ) : (
              <Heatmap
                data={{
                  weekLabels: a.heatmap.weekLabels,
                  weekShorts: a.heatmap.weekLabels.map(shortWeekLabel),
                  rows: a.heatmap.rows,
                }}
                unit="чел."
                tableCaption="Упоминания проектов по неделям"
              />
            )}
          </ChartCard>
        </div>

        {director && (
          <DirectorQuarterReviews
            quarters={director.quarters}
            periodLabel={director.periodLabel}
            employees={director.employees}
          />
        )}
      </main>
    </>
  );
}

function StatTile({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div className="card p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-ink">{value}</p>
      {note && <p className="mt-0.5 text-xs text-faint">{note}</p>}
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  wide = false,
  children,
}: {
  title: string;
  subtitle: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className={`card p-5 ${wide ? "lg:col-span-2" : ""}`}>
      <h2 className="font-medium text-ink">{title}</h2>
      <p className="mb-4 mt-0.5 text-xs text-muted">{subtitle}</p>
      {children}
    </section>
  );
}

function EmptyNote() {
  return (
    <p className="py-6 text-center text-sm text-faint">
      Нет данных за выбранный период.
    </p>
  );
}

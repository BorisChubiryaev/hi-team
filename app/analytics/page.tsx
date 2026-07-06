import Header from "@/components/Header";
import AnalyticsFilters from "@/components/AnalyticsFilters";
import ColumnChart from "@/components/charts/ColumnChart";
import HBarChart from "@/components/charts/HBarChart";
import Heatmap from "@/components/charts/Heatmap";
import { getAnalytics } from "@/lib/analytics";
import { requireDbUser } from "@/lib/auth";
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

  const a = await getAnalytics({
    weeksLimit: all ? 0 : weeks,
    userId,
    projectId,
    status,
  });
  const withShort = (points: { label: string; value: number }[]) =>
    points.map((p) => ({ ...p, short: shortWeekLabel(p.label) }));

  return (
    <>
      <Header
        email={me.email}
        active="analytics"
        isLead={me.role === "LEAD"}
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

        {/* Фильтры — скоупят все графики ниже */}
        <AnalyticsFilters
          users={a.options.users}
          projects={a.options.projects}
          weeks={weeks}
          all={all}
          userId={userId}
          projectId={projectId}
          status={status}
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

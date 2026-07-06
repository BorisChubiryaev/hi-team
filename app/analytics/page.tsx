import Link from "next/link";
import Header from "@/components/Header";
import ColumnChart from "@/components/charts/ColumnChart";
import HBarChart from "@/components/charts/HBarChart";
import Heatmap from "@/components/charts/Heatmap";
import { getAnalytics } from "@/lib/analytics";
import { requireDbUser } from "@/lib/auth";
import { shortWeekLabel } from "@/lib/weeks";

export const dynamic = "force-dynamic";

const RANGES = [
  { key: "8", label: "8 недель", weeks: 8 },
  { key: "12", label: "12 недель", weeks: 12 },
  { key: "all", label: "Всё время", weeks: 0 },
] as const;

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const me = await requireDbUser();

  const params = await searchParams;
  const requested = Array.isArray(params.range) ? params.range[0] : params.range;
  const range = RANGES.find((r) => r.key === requested) ?? RANGES[1];

  const a = await getAnalytics(range.weeks);
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

        {/* Период — скоупит все графики ниже */}
        <div className="mb-4 flex flex-wrap items-center gap-1.5">
          {RANGES.map((r) => (
            <Link
              key={r.key}
              href={`/analytics?range=${r.key}`}
              className={`rounded-full px-3 py-1.5 text-sm transition ${
                r.key === range.key
                  ? "bg-ink font-medium text-card"
                  : "border border-line bg-card text-muted hover:bg-panel hover:text-ink"
              }`}
            >
              {r.label}
            </Link>
          ))}
        </div>

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

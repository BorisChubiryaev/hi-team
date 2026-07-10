import { redirect } from "next/navigation";
import Header from "@/components/Header";
import ReviewPeriodPicker from "@/components/ReviewPeriodPicker";
import ReviewPrepPanel from "@/components/ReviewPrepPanel";
import { requireDbUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  customPeriod,
  parseQuarterKey,
  recentQuarters,
  type Period,
} from "@/lib/periods";
import { getReviewData } from "@/lib/review";
import { writesReports } from "@/lib/roles";
import { isoDate } from "@/lib/weeks";

export const dynamic = "force-dynamic";

function firstParam(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const me = await requireDbUser();
  // Раздел личный и опирается на собственные отчёты — Руководитель их не пишет.
  if (!writesReports(me.role)) redirect("/dashboard");

  const quarters = recentQuarters(4);
  const params = await searchParams;

  const startParam = firstParam(params.start);
  const endParam = firstParam(params.end);
  const periodParam = firstParam(params.period);

  let selected: Period;
  if (startParam && endParam && customPeriod(startParam, endParam)) {
    selected = customPeriod(startParam, endParam)!;
  } else if (periodParam && parseQuarterKey(periodParam)) {
    selected = parseQuarterKey(periodParam)!;
  } else {
    selected = quarters[0];
  }

  const startIso = isoDate(selected.start);
  const endIso = isoDate(selected.end);

  // Кварталы слева направо: от старых к текущему (текущий — справа).
  const quartersChrono = [...quarters]
    .reverse()
    .map((q) => ({ key: q.key, label: q.label }));

  const [data, existing] = await Promise.all([
    getReviewData(me.id, selected.start, selected.end),
    prisma.reviewPrep.findUnique({
      where: {
        userId_periodStart_periodEnd: {
          userId: me.id,
          periodStart: selected.start,
          periodEnd: selected.end,
        },
      },
    }),
  ]);

  return (
    <>
      <Header email={me.email} active="review" role={me.role} />
      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
        <div className="mb-5">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            Подготовка к встрече с руководителем
          </h1>
          <p className="mt-1 text-sm text-muted">
            Соберите резюме своей работы за период, чтобы уверенно выступить на
            встрече 1:1. AI подготовит достижения, вклад по проектам и темы для
            разговора — по вашим же отчётам.
          </p>
        </div>

        {/* Выбор периода: кварталы + произвольный диапазон */}
        <div className="mb-5">
          <ReviewPeriodPicker
            quarters={quartersChrono}
            selectedKey={selected.key}
            startIso={startIso}
            endIso={endIso}
          />
        </div>

        {/* Факты за период */}
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile
            label="Сдано недель"
            value={`${data.stats.weeksReported} из ${data.stats.weeksTotal}`}
          />
          <StatTile label="Проектов" value={String(data.stats.projects)} />
          <StatTile
            label="Записей «сделано»"
            value={String(data.stats.doneEntries)}
          />
          <StatTile label="Блокеров" value={String(data.stats.blockers)} />
        </div>

        <ReviewPrepPanel
          key={selected.key}
          start={startIso}
          end={endIso}
          label={selected.label}
          initialContent={existing?.content ?? null}
          initialFocus={existing?.focus ?? ""}
          initialGeneratedAt={
            existing
              ? new Date(existing.updatedAt).toLocaleDateString("ru-RU")
              : null
          }
          hasData={data.hasData}
          telegramConnected={Boolean(me.telegramChatId)}
        />
      </main>
    </>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-0.5 text-xl font-semibold text-ink">{value}</p>
    </div>
  );
}

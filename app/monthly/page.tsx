import Link from "next/link";
import Header from "@/components/Header";
import MonthSummaryPanel from "@/components/MonthSummaryPanel";
import { requireDbUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatMonthLabel, monthKey } from "@/lib/weeks";

export const dynamic = "force-dynamic";

export default async function MonthlyPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const me = await requireDbUser();

  const weeks = await prisma.week.findMany({
    orderBy: { startDate: "desc" },
    include: { reports: { select: { id: true } } },
  });

  // Месяцы, в которых есть недели с отчётами, новые сверху.
  const months: string[] = [];
  for (const w of weeks) {
    if (w.reports.length === 0) continue;
    const key = monthKey(w.startDate);
    if (!months.includes(key)) months.push(key);
  }

  const params = await searchParams;
  const requested = Array.isArray(params.month) ? params.month[0] : params.month;
  const selected = months.includes(requested ?? "") ? requested! : months[0];

  const summary = selected
    ? await prisma.monthSummary.findUnique({ where: { month: selected } })
    : null;

  return (
    <>
      <Header
        email={me.email}
        active="monthly"
        role={me.role}
      />
      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
        <div className="mb-5">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            Итоги месяца
          </h1>
          <p className="mt-1 text-sm text-muted">
            AI-агрегация недельных отчётов за месяц — удобно для отчётности
            наверх. Экспортируется в Markdown или Word вместе с отчётами всех
            недель.
          </p>
        </div>

        {months.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line-strong p-10 text-center text-muted">
            Пока нет ни одного отчёта — итоги месяца появятся, когда команда
            начнёт заполнять недели.
          </p>
        ) : (
          <>
            <div className="mb-5 flex flex-wrap items-center gap-1.5">
              {months.map((m) => (
                <Link
                  key={m}
                  href={`/monthly?month=${m}`}
                  className={`rounded-full px-3 py-1.5 text-sm transition ${
                    m === selected
                      ? "bg-ink font-medium text-card"
                      : "border border-line bg-card text-muted hover:bg-panel hover:text-ink"
                  }`}
                >
                  {formatMonthLabel(m)}
                </Link>
              ))}
            </div>

            <MonthSummaryPanel
              key={selected}
              month={selected}
              initialContent={summary?.content ?? null}
              initialGeneratedAt={
                summary
                  ? new Date(summary.updatedAt).toLocaleDateString("ru-RU")
                  : null
              }
              hasReports
            />
          </>
        )}
      </main>
    </>
  );
}

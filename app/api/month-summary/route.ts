// Генерация AI-итогов месяца: POST {"month": "YYYY-MM"}.

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { summarizeMonth } from "@/lib/openrouter";
import { formatMonthLabel } from "@/lib/weeks";

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  let month: string | undefined;
  try {
    ({ month } = await req.json());
  } catch {
    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  }
  if (!month || !MONTH_RE.test(month)) {
    return NextResponse.json(
      { error: "month обязателен (YYYY-MM)" },
      { status: 400 },
    );
  }

  const [year, m] = month.split("-").map(Number);
  const from = new Date(Date.UTC(year, m - 1, 1));
  const to = new Date(Date.UTC(year, m, 1));

  const weeks = await prisma.week.findMany({
    where: { startDate: { gte: from, lt: to } },
    orderBy: { startDate: "asc" },
    include: {
      summary: true,
      reports: {
        include: {
          user: true,
          projects: { orderBy: { order: "asc" } },
        },
      },
    },
  });

  const withReports = weeks.filter((w) => w.reports.length > 0);
  if (withReports.length === 0) {
    return NextResponse.json(
      { error: "За этот месяц нет отчётов" },
      { status: 400 },
    );
  }

  try {
    const { content, model } = await summarizeMonth({
      monthLabel: formatMonthLabel(month),
      weeks: withReports.map((w) => ({
        weekLabel: w.label,
        summary: w.summary?.content ?? null,
        reports: w.reports.map((r) => ({
          name: r.user.name ?? r.user.email,
          projects: r.projects,
        })),
      })),
    });

    await prisma.monthSummary.upsert({
      where: { month },
      update: { content, model },
      create: { month, content, model },
    });

    return NextResponse.json({ content, model });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Ошибка генерации";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

// Экспорт в Markdown: /api/export?weekId=... — одна неделя,
// /api/export?month=YYYY-MM — месяц целиком (итоги + все недели).
// Удобно вставить в Confluence или письмо руководству.

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatMonthLabel, isoDate } from "@/lib/weeks";

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

type WeekWithReports = {
  label: string;
  summary: { content: string } | null;
  reports: {
    user: { name: string | null; email: string };
    projects: { name: string; done: string; blockers: string; plans: string }[];
  }[];
};

function weekMarkdown(week: WeekWithReports, heading: string): string[] {
  const lines: string[] = [`${heading} Отчёты за неделю ${week.label}`, ""];

  if (week.summary) {
    lines.push(`${heading}# Сводка недели (AI)`, "", week.summary.content, "");
  }

  for (const r of week.reports) {
    lines.push(`${heading}# ${r.user.name ?? r.user.email}`, "");
    if (r.projects.length === 0) {
      lines.push("_Нет данных._", "");
      continue;
    }
    for (const p of r.projects) {
      lines.push(`${heading}## ${p.name || "Без названия"}`, "");
      if (p.done.trim()) lines.push("**Сделано:**", "", p.done.trim(), "");
      if (p.blockers.trim())
        lines.push("**Блокеры:**", "", p.blockers.trim(), "");
      if (p.plans.trim()) lines.push("**Планы:**", "", p.plans.trim(), "");
    }
  }
  return lines;
}

function markdownResponse(lines: string[], filename: string) {
  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

const weekInclude = {
  summary: true,
  reports: {
    include: {
      user: true,
      projects: { orderBy: { order: "asc" as const } },
    },
    orderBy: { user: { createdAt: "asc" as const } },
  },
};

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const url = new URL(req.url);
  const weekId = url.searchParams.get("weekId");
  const month = url.searchParams.get("month");

  if (weekId) {
    const week = await prisma.week.findUnique({
      where: { id: weekId },
      include: weekInclude,
    });
    if (!week) {
      return NextResponse.json({ error: "Неделя не найдена" }, { status: 404 });
    }
    return markdownResponse(
      weekMarkdown(week, "#"),
      `week-${isoDate(week.startDate)}.md`,
    );
  }

  if (month && MONTH_RE.test(month)) {
    const [year, m] = month.split("-").map(Number);
    const from = new Date(Date.UTC(year, m - 1, 1));
    const to = new Date(Date.UTC(year, m, 1));

    const [weeks, monthSummary] = await Promise.all([
      prisma.week.findMany({
        where: { startDate: { gte: from, lt: to } },
        orderBy: { startDate: "asc" },
        include: weekInclude,
      }),
      prisma.monthSummary.findUnique({ where: { month } }),
    ]);
    if (weeks.length === 0) {
      return NextResponse.json(
        { error: "За этот месяц нет недель" },
        { status: 404 },
      );
    }

    const lines: string[] = [`# Итоги: ${formatMonthLabel(month)}`, ""];
    if (monthSummary) {
      lines.push("## Итоги месяца (AI)", "", monthSummary.content, "");
    }
    for (const w of weeks) {
      lines.push(...weekMarkdown(w, "##"));
    }
    return markdownResponse(lines, `month-${month}.md`);
  }

  return NextResponse.json(
    { error: "Укажите weekId или month=YYYY-MM" },
    { status: 400 },
  );
}

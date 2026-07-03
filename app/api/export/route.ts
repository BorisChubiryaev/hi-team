// Экспорт недели в Markdown: /api/export?weekId=... — удобно вставить
// в Confluence или письмо руководству.

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isoDate } from "@/lib/weeks";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const weekId = new URL(req.url).searchParams.get("weekId");
  if (!weekId) {
    return NextResponse.json({ error: "weekId обязателен" }, { status: 400 });
  }

  const week = await prisma.week.findUnique({
    where: { id: weekId },
    include: {
      summary: true,
      reports: {
        include: {
          user: true,
          projects: { orderBy: { order: "asc" } },
        },
        orderBy: { user: { createdAt: "asc" } },
      },
    },
  });
  if (!week) {
    return NextResponse.json({ error: "Неделя не найдена" }, { status: 404 });
  }

  const lines: string[] = [`# Отчёты команды за неделю ${week.label}`, ""];

  if (week.summary) {
    lines.push("## Сводка недели (AI)", "", week.summary.content, "");
  }

  for (const r of week.reports) {
    lines.push(`## ${r.user.name ?? r.user.email}`, "");
    if (r.projects.length === 0) {
      lines.push("_Нет данных._", "");
      continue;
    }
    for (const p of r.projects) {
      lines.push(`### ${p.name || "Без названия"}`, "");
      if (p.done.trim()) lines.push("**Сделано:**", "", p.done.trim(), "");
      if (p.blockers.trim())
        lines.push("**Блокеры:**", "", p.blockers.trim(), "");
      if (p.plans.trim()) lines.push("**Планы:**", "", p.plans.trim(), "");
    }
  }

  const filename = `week-${isoDate(week.startDate)}.md`;
  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

// Экспорт отчётов: /api/export?weekId=... — одна неделя,
// /api/export?month=YYYY-MM — месяц целиком (итоги + все недели).
// Формат: по умолчанию Markdown; ?format=docx — документ Word (.docx).

import { NextResponse } from "next/server";
import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatMonthLabel, isoDate } from "@/lib/weeks";

export const runtime = "nodejs";

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

type WeekWithReports = {
  label: string;
  summary: { content: string } | null;
  reports: {
    user: { name: string | null; email: string };
    projects: { name: string; done: string; blockers: string; plans: string }[];
  }[];
};

// ---------------------------------------------------------------------------
// Markdown
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// DOCX (Word)
// ---------------------------------------------------------------------------

/** Разбивает строку с **жирным** на runs Word. */
function inlineRuns(text: string): TextRun[] {
  const runs: TextRun[] = [];
  for (const part of text.split(/(\*\*[^*]+\*\*)/g)) {
    if (!part) continue;
    const bold = /^\*\*([^*]+)\*\*$/.exec(part);
    runs.push(bold ? new TextRun({ text: bold[1], bold: true }) : new TextRun(part));
  }
  return runs.length ? runs : [new TextRun(text)];
}

/** Простой Markdown → абзацы Word (заголовки, списки, жирный). */
function mdToParagraphs(md: string): Paragraph[] {
  const out: Paragraph[] = [];
  for (const raw of md.split("\n")) {
    const line = raw.trimEnd();
    if (!line.trim()) continue;
    let m: RegExpExecArray | null;
    if ((m = /^#{1,2}\s+(.*)$/.exec(line))) {
      out.push(
        new Paragraph({ heading: HeadingLevel.HEADING_2, children: inlineRuns(m[1]) }),
      );
    } else if ((m = /^#{3,}\s+(.*)$/.exec(line))) {
      out.push(
        new Paragraph({ heading: HeadingLevel.HEADING_3, children: inlineRuns(m[1]) }),
      );
    } else if ((m = /^\s*[-*]\s+(.*)$/.exec(line))) {
      out.push(new Paragraph({ bullet: { level: 0 }, children: inlineRuns(m[1]) }));
    } else {
      out.push(new Paragraph({ children: inlineRuns(line.trim()) }));
    }
  }
  return out;
}

/** Поле отчёта (Сделано/Блокеры/Планы): жирная метка + многострочный текст. */
function fieldParagraphs(label: string, value: string): Paragraph[] {
  const v = value.trim();
  if (!v) return [];
  const lines = v.split("\n");
  const paras: Paragraph[] = [
    new Paragraph({
      children: [new TextRun({ text: `${label}: `, bold: true }), ...inlineRuns(lines[0])],
    }),
  ];
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim()) paras.push(new Paragraph({ children: inlineRuns(lines[i]) }));
  }
  return paras;
}

function weekParagraphs(week: WeekWithReports): Paragraph[] {
  const out: Paragraph[] = [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      text: `Отчёты за неделю ${week.label}`,
    }),
  ];
  if (week.summary) {
    out.push(new Paragraph({ heading: HeadingLevel.HEADING_2, text: "Сводка недели (AI)" }));
    out.push(...mdToParagraphs(week.summary.content));
  }
  for (const r of week.reports) {
    out.push(
      new Paragraph({ heading: HeadingLevel.HEADING_2, text: r.user.name ?? r.user.email }),
    );
    if (r.projects.length === 0) {
      out.push(new Paragraph({ children: [new TextRun({ text: "Нет данных.", italics: true })] }));
      continue;
    }
    for (const p of r.projects) {
      out.push(
        new Paragraph({ heading: HeadingLevel.HEADING_3, text: p.name || "Без названия" }),
      );
      out.push(...fieldParagraphs("Сделано", p.done));
      out.push(...fieldParagraphs("Блокеры", p.blockers));
      out.push(...fieldParagraphs("Планы", p.plans));
    }
  }
  return out;
}

async function docxResponse(children: Paragraph[], filename: string) {
  const doc = new Document({ sections: [{ children }] });
  const buf = await Packer.toBuffer(doc);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

// ---------------------------------------------------------------------------

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
  const docx = url.searchParams.get("format") === "docx";

  if (weekId) {
    const week = await prisma.week.findUnique({
      where: { id: weekId },
      include: weekInclude,
    });
    if (!week) {
      return NextResponse.json({ error: "Неделя не найдена" }, { status: 404 });
    }
    const base = `week-${isoDate(week.startDate)}`;
    return docx
      ? docxResponse(weekParagraphs(week), `${base}.docx`)
      : markdownResponse(weekMarkdown(week, "#"), `${base}.md`);
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

    if (docx) {
      const children: Paragraph[] = [
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          text: `Итоги: ${formatMonthLabel(month)}`,
        }),
      ];
      if (monthSummary) {
        children.push(
          new Paragraph({ heading: HeadingLevel.HEADING_2, text: "Итоги месяца (AI)" }),
        );
        children.push(...mdToParagraphs(monthSummary.content));
      }
      for (const w of weeks) children.push(...weekParagraphs(w));
      return docxResponse(children, `month-${month}.docx`);
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

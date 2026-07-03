import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { summarizeProject } from "@/lib/openrouter";

// Сколько последних недель с упоминаниями проекта отдаём модели.
const MAX_WEEKS = 8;

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const { id } = await params;
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) {
    return NextResponse.json({ error: "Проект не найден" }, { status: 404 });
  }

  const entries = await prisma.reportProject.findMany({
    where: { projectId: id },
    include: { report: { include: { user: true, week: true } } },
  });
  if (entries.length === 0) {
    return NextResponse.json(
      { error: "По проекту нет упоминаний в отчётах" },
      { status: 400 },
    );
  }

  // Группируем по неделям, от старых к новым, берём последние MAX_WEEKS.
  const byWeek = new Map<
    string,
    { startDate: Date; weekLabel: string; entries: (typeof entries)[number][] }
  >();
  for (const e of entries) {
    const w = e.report.week;
    const group =
      byWeek.get(w.id) ??
      { startDate: w.startDate, weekLabel: w.label, entries: [] };
    group.entries.push(e);
    byWeek.set(w.id, group);
  }
  const weeks = [...byWeek.values()]
    .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
    .slice(-MAX_WEEKS)
    .map((w) => ({
      weekLabel: w.weekLabel,
      entries: w.entries.map((e) => ({
        userName: e.report.user.name ?? e.report.user.email,
        done: e.done,
        blockers: e.blockers,
        plans: e.plans,
      })),
    }));

  try {
    const { content, model } = await summarizeProject({
      projectName: project.name,
      weeks,
    });

    await prisma.project.update({
      where: { id },
      data: { aiSummary: content, aiSummaryModel: model, aiSummaryAt: new Date() },
    });

    return NextResponse.json({ content, model });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Ошибка генерации";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

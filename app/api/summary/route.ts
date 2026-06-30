import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { summarizeWeek } from "@/lib/openrouter";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  let weekId: string | undefined;
  try {
    ({ weekId } = await req.json());
  } catch {
    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  }
  if (!weekId) {
    return NextResponse.json({ error: "weekId обязателен" }, { status: 400 });
  }

  const week = await prisma.week.findUnique({
    where: { id: weekId },
    include: {
      reports: {
        include: {
          user: true,
          projects: { orderBy: { order: "asc" } },
        },
      },
    },
  });

  if (!week) {
    return NextResponse.json({ error: "Неделя не найдена" }, { status: 404 });
  }
  if (week.reports.length === 0) {
    return NextResponse.json(
      { error: "За эту неделю нет отчётов" },
      { status: 400 },
    );
  }

  try {
    const { content, model } = await summarizeWeek({
      weekLabel: week.label,
      reports: week.reports.map((r) => ({
        name: r.user.name ?? r.user.email,
        projects: r.projects,
      })),
    });

    await prisma.summary.upsert({
      where: { weekId },
      update: { content, model },
      create: { weekId, content, model },
    });

    return NextResponse.json({ content, model });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Ошибка генерации";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

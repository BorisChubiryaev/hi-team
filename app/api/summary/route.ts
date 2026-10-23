import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canGenerateSummary } from "@/lib/roles";
import { generateWeekSummary } from "@/lib/summary";

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

  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { workspaceId: true, role: true, active: true },
  });
  if (!me?.active || !canGenerateSummary(me.role)) {
    return NextResponse.json(
      { error: "Запускать AI-сводку может только руководитель" },
      { status: 403 },
    );
  }
  const result = await generateWeekSummary(weekId, me?.workspaceId ?? null);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ content: result.content, model: result.model });
}

// Генерация личной подготовки к встрече 1:1: POST { start, end, label, focus }.

import { NextResponse } from "next/server";
import { requireDbUser } from "@/lib/auth";
import { customPeriod } from "@/lib/periods";
import { generateAndSaveReviewPrep } from "@/lib/review";
import { writesReports } from "@/lib/roles";

export async function POST(req: Request) {
  const user = await requireDbUser();
  if (!writesReports(user.role)) {
    return NextResponse.json(
      { error: "Ваша роль не заполняет отчёты" },
      { status: 403 },
    );
  }

  let body: { start?: string; end?: string; label?: string; focus?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  }

  const period = customPeriod(body.start ?? "", body.end ?? "");
  if (!period) {
    return NextResponse.json({ error: "Некорректный период" }, { status: 400 });
  }

  const focus = typeof body.focus === "string" ? body.focus.slice(0, 500) : "";
  const label = (body.label ?? period.label).slice(0, 120);

  try {
    const { content, model } = await generateAndSaveReviewPrep({
      userId: user.id,
      userName: user.name ?? user.email,
      start: period.start,
      end: period.end,
      label,
      focus,
    });
    return NextResponse.json({ content, model });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Ошибка генерации";
    // «Нет отчётов» — ожидаемая ситуация, отдаём 400.
    const status = message.includes("нет отчётов") ? 400 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}

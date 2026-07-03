// Одноразовый бэкфилл: группирует существующие ReportProject по имени
// (без учёта регистра, с нормализацией пробелов), создаёт Project и
// проставляет projectId. Безопасно запускать повторно — обрабатываются
// только строки с projectId = null.
//
// Запуск: npm run db:backfill-projects

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function normalize(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

async function main() {
  const rows = await prisma.reportProject.findMany({
    where: { projectId: null },
    select: { id: true, name: true },
  });

  // ключ = имя в нижнем регистре; display = первое встреченное написание
  const groups = new Map<string, { display: string; ids: string[] }>();
  for (const row of rows) {
    const display = normalize(row.name);
    if (!display) continue;
    const key = display.toLowerCase();
    const group = groups.get(key) ?? { display, ids: [] };
    group.ids.push(row.id);
    groups.set(key, group);
  }

  let linked = 0;
  for (const { display, ids } of groups.values()) {
    const existing = await prisma.project.findFirst({
      where: { name: { equals: display, mode: "insensitive" } },
      select: { id: true },
    });
    const project =
      existing ??
      (await prisma.project.create({
        data: { name: display },
        select: { id: true },
      }));
    const res = await prisma.reportProject.updateMany({
      where: { id: { in: ids } },
      data: { projectId: project.id },
    });
    linked += res.count;
  }

  console.log(`✅ Проектов: ${groups.size}, привязано строк отчётов: ${linked}.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

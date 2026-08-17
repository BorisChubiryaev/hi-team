// Разовый бэкфилл при переходе на мультитенант (Фаза 1): создаёт команду по
// умолчанию и переносит в неё все существующие данные (workspaceId был null).
// Плюс назначает супер-админа. Идемпотентно — можно запускать повторно.
//
// Запуск:  DATABASE_URL="<prod>" npx tsx prisma/backfill-workspace.ts

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SUPER_ADMIN_EMAIL = "boriksnote@gmail.com";

async function main() {
  const ws = await prisma.workspace.upsert({
    where: { slug: "main" },
    update: {},
    create: { name: "Основная команда", slug: "main" },
  });
  const data = { workspaceId: ws.id };
  const where = { workspaceId: null };

  // Последовательно — пул Neon (особенно после cold start) не любит пачку
  // параллельных запросов.
  const users = await prisma.user.updateMany({ where, data });
  const projects = await prisma.project.updateMany({ where, data });
  const reports = await prisma.report.updateMany({ where, data });
  const summaries = await prisma.summary.updateMany({ where, data });
  const months = await prisma.monthSummary.updateMany({ where, data });
  const allowed = await prisma.allowedEmail.updateMany({ where, data });
  const bot = await prisma.botSettings.updateMany({ where, data });
  const su = await prisma.user.updateMany({
    where: { email: SUPER_ADMIN_EMAIL.toLowerCase() },
    data: { isSuperAdmin: true },
  });

  console.log("workspace:", ws.id, ws.slug);
  console.log({
    users: users.count,
    projects: projects.count,
    reports: reports.count,
    summaries: summaries.count,
    monthSummaries: months.count,
    allowedEmails: allowed.count,
    botSettings: bot.count,
    superAdminSet: su.count,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

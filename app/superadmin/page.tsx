import Header from "@/components/Header";
import SuperAdminPanel from "@/components/SuperAdminPanel";
import { requireSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata = { title: "Супер-админ — hi-team" };

export default async function SuperAdminPage() {
  const me = await requireSuperAdmin();

  const [workspaces, users, allowed] = await Promise.all([
    prisma.workspace.findMany({
      orderBy: { createdAt: "asc" },
      include: { _count: { select: { users: true, allowedEmails: true } } },
    }),
    prisma.user.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        workspaceId: true,
        role: true,
        isSuperAdmin: true,
      },
    }),
    prisma.allowedEmail.findMany({
      orderBy: { email: "asc" },
      select: { id: true, email: true, workspaceId: true },
    }),
  ]);

  return (
    <>
      <Header email={me.email} active="superadmin" role={me.role} isSuperAdmin={me.isSuperAdmin} />
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            Супер-админ
          </h1>
          <p className="mt-1 text-sm text-muted">
            Управление командами: создать команду, назначить людей и роли, задать
            доступ (allowlist) по командам. Данные команд не пересекаются.
          </p>
        </div>

        <SuperAdminPanel
          workspaces={workspaces.map((w) => ({
            id: w.id,
            name: w.name,
            slug: w.slug,
            members: w._count.users,
            allowed: w._count.allowedEmails,
          }))}
          users={users}
          allowed={allowed}
        />
      </main>
    </>
  );
}

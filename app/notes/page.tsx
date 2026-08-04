import Header from "@/components/Header";
import NotesPanel from "@/components/NotesPanel";
import { requireDbUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Заметки — hi-team",
};

export default async function NotesPage() {
  const me = await requireDbUser();

  const notes = await prisma.note.findMany({
    where: { userId: me.id },
    orderBy: { updatedAt: "desc" },
    select: { id: true, content: true, updatedAt: true },
  });

  return (
    <>
      <Header email={me.email} active="notes" role={me.role} />
      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            Заметки
          </h1>
          <p className="mt-1 text-sm text-muted">
            Личное пространство для мыслей, статусов и напоминаний себе. Видно
            только вам.
          </p>
        </div>
        <NotesPanel notes={notes} />
      </main>
    </>
  );
}

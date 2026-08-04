"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createNote, deleteNote, updateNote } from "@/app/notes/actions";

type Note = { id: string; content: string; updatedAt: Date | string };

function formatDate(v: Date | string): string {
  const d = typeof v === "string" ? new Date(v) : v;
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleString("ru-RU", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
}

export default function NotesPanel({ notes }: { notes: Note[] }) {
  const router = useRouter();
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    setError("");
    startTransition(async () => {
      const res = await action();
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  }

  function add() {
    if (!draft.trim()) return;
    run(async () => {
      const res = await createNote(draft);
      if (res.ok) setDraft("");
      return res;
    });
  }

  return (
    <div className="space-y-6">
      <div className="card p-4">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={3}
          placeholder="Новая заметка: мысль, статус, напоминание себе…"
          className="input min-h-20 resize-y"
        />
        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            onClick={add}
            disabled={pending || !draft.trim()}
            className="btn btn-primary"
          >
            Добавить
          </button>
          {error && <span className="text-sm text-danger">{error}</span>}
        </div>
      </div>

      {notes.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line-strong p-8 text-center text-muted">
          Пока пусто. Добавьте первую заметку выше.
        </p>
      ) : (
        <div className="space-y-4">
          {notes.map((n) => (
            <NoteCard
              key={n.id}
              note={n}
              pending={pending}
              onSave={(content) => run(() => updateNote(n.id, content))}
              onDelete={() => run(() => deleteNote(n.id))}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function NoteCard({
  note,
  pending,
  onSave,
  onDelete,
}: {
  note: Note;
  pending: boolean;
  onSave: (content: string) => void;
  onDelete: () => void;
}) {
  const [content, setContent] = useState(note.content);
  const changed = content.trim() !== note.content.trim() && content.trim() !== "";

  return (
    <div className="card p-4">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={3}
        className="input min-h-20 resize-y"
      />
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => onSave(content)}
          disabled={pending || !changed}
          className="btn btn-ghost btn-sm"
        >
          Сохранить
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={pending}
          className="rounded-full px-3 py-1.5 text-xs font-medium text-danger transition hover:bg-danger-bg disabled:opacity-40"
        >
          Удалить
        </button>
        <span className="ml-auto text-xs text-faint">
          {formatDate(note.updatedAt)}
        </span>
      </div>
    </div>
  );
}

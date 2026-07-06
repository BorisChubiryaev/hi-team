"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  deleteProject,
  mergeProjects,
  renameProject,
} from "@/app/projects/actions";

export default function ProjectAdminPanel({
  projectId,
  projectName,
  otherProjects,
}: {
  projectId: string;
  projectName: string;
  otherProjects: { id: string; name: string }[];
}) {
  const [name, setName] = useState(projectName);
  const [mergeTarget, setMergeTarget] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function onRename() {
    setError("");
    startTransition(async () => {
      const res = await renameProject(projectId, name);
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  }

  function onDelete() {
    if (
      !window.confirm(
        `Удалить проект «${projectName}»? Отчёты сохранятся, но перестанут быть привязаны к этому проекту (история строк не теряется). Действие необратимо.`,
      )
    ) {
      return;
    }
    setError("");
    startTransition(async () => {
      const res = await deleteProject(projectId);
      if (!res.ok) setError(res.error);
      else router.push("/projects");
    });
  }

  function onMerge() {
    const target = otherProjects.find((p) => p.id === mergeTarget);
    if (!target) return;
    if (
      !window.confirm(
        `Слить «${projectName}» в «${target.name}»? Все упоминания перейдут в «${target.name}», этот проект будет удалён. Действие необратимо.`,
      )
    ) {
      return;
    }
    setError("");
    startTransition(async () => {
      const res = await mergeProjects(projectId, mergeTarget);
      if (!res.ok) setError(res.error);
      else router.push(`/projects/${mergeTarget}`);
    });
  }

  return (
    <div className="card p-5">
      <h2 className="mb-3 font-semibold text-ink">Управление проектом</h2>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="input max-w-md"
          aria-label="Новое имя проекта"
        />
        <button
          type="button"
          onClick={onRename}
          disabled={pending || !name.trim() || name.trim() === projectName}
          className="btn btn-ghost"
        >
          Переименовать
        </button>
      </div>

      {otherProjects.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <select
            value={mergeTarget}
            onChange={(e) => setMergeTarget(e.target.value)}
            className="input max-w-md"
            aria-label="Слить с проектом"
          >
            <option value="">Слить с проектом…</option>
            {otherProjects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={onMerge}
            disabled={pending || !mergeTarget}
            className="btn btn-danger"
          >
            Слить
          </button>
        </div>
      )}

      <p className="mt-3 text-xs text-muted">
        Слияние переносит все упоминания в выбранный проект и удаляет текущий.
        Используйте для дублей вида «Дешборд X» / «Дэшборд X».
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line pt-4">
        <button
          type="button"
          onClick={onDelete}
          disabled={pending}
          className="rounded-full border border-danger/40 px-4 py-2 text-sm font-medium text-danger transition hover:bg-danger-bg disabled:opacity-50"
        >
          Удалить проект
        </button>
        <span className="text-xs text-muted">
          Отчёты сохранятся — строки просто отвяжутся от проекта.
        </span>
      </div>

      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </div>
  );
}

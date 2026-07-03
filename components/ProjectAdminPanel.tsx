"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { mergeProjects, renameProject } from "@/app/projects/actions";

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
    <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <h2 className="mb-3 font-semibold text-slate-900 dark:text-white">
        Управление проектом
      </h2>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full max-w-md rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
          aria-label="Новое имя проекта"
        />
        <button
          type="button"
          onClick={onRename}
          disabled={pending || !name.trim() || name.trim() === projectName}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          Переименовать
        </button>
      </div>

      {otherProjects.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <select
            value={mergeTarget}
            onChange={(e) => setMergeTarget(e.target.value)}
            className="w-full max-w-md rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
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
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-50"
          >
            Слить
          </button>
        </div>
      )}

      <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
        Слияние переносит все упоминания в выбранный проект и удаляет текущий.
        Используйте для дублей вида «Дешборд X» / «Дэшборд X».
      </p>

      {error && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}

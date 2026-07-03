"use client";

import { useState } from "react";

export default function ProjectSummaryPanel({
  projectId,
  initialContent,
  initialGeneratedAt,
  hasEntries,
}: {
  projectId: string;
  initialContent: string | null;
  initialGeneratedAt: string | null;
  hasEntries: boolean;
}) {
  const [content, setContent] = useState(initialContent ?? "");
  const [generatedAt, setGeneratedAt] = useState(initialGeneratedAt ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function generate() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/projects/${projectId}/summary`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Ошибка генерации");
      setContent(data.content);
      setGeneratedAt(new Date().toLocaleDateString("ru-RU"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-5 dark:border-blue-900 dark:bg-blue-950/20">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold text-blue-900 dark:text-blue-200">
          AI-статус проекта
        </h2>
        <button
          type="button"
          onClick={generate}
          disabled={loading || !hasEntries}
          title={!hasEntries ? "По проекту нет упоминаний в отчётах" : undefined}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
        >
          {loading
            ? "Генерация…"
            : content
              ? "Обновить статус"
              : "Сгенерировать статус"}
        </button>
      </div>

      {error && (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>
      )}

      {content ? (
        <>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-200">
            {content}
          </p>
          {generatedAt && (
            <p className="mt-2 text-[11px] text-slate-400">
              Сгенерировано: {generatedAt}
            </p>
          )}
        </>
      ) : (
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
          Сводка по проекту за последние недели — для отчётности наверх.
        </p>
      )}
    </div>
  );
}

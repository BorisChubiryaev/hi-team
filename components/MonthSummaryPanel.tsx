"use client";

import { useState } from "react";

export default function MonthSummaryPanel({
  month,
  initialContent,
  initialGeneratedAt,
  hasReports,
}: {
  month: string;
  initialContent: string | null;
  initialGeneratedAt: string | null;
  hasReports: boolean;
}) {
  const [content, setContent] = useState(initialContent ?? "");
  const [generatedAt, setGeneratedAt] = useState(initialGeneratedAt ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function generate() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/month-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month }),
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold text-blue-900 dark:text-blue-200">
          AI-итоги месяца
        </h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={generate}
            disabled={loading || !hasReports}
            title={!hasReports ? "За этот месяц нет отчётов" : undefined}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
          >
            {loading
              ? "Генерация…"
              : content
                ? "Обновить итоги"
                : "Сгенерировать итоги"}
          </button>
          {content && (
            <a
              href={`/api/export?month=${month}`}
              className="rounded-md border border-blue-300 px-3 py-1.5 text-xs font-medium text-blue-700 transition hover:bg-blue-100 dark:border-blue-800 dark:text-blue-300 dark:hover:bg-blue-950"
            >
              Экспорт .md
            </a>
          )}
        </div>
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
          Агрегированные итоги месяца по всем отчётам и недельным сводкам —
          для отчётности наверх.
        </p>
      )}
    </div>
  );
}

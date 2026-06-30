"use client";

import { useState } from "react";

export default function SummaryCell({
  weekId,
  initialContent,
  initialModel,
  hasReports,
}: {
  weekId: string;
  initialContent: string | null;
  initialModel: string | null;
  hasReports: boolean;
}) {
  const [content, setContent] = useState(initialContent ?? "");
  const [model, setModel] = useState(initialModel ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function generate() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Ошибка генерации");
      setContent(data.content);
      setModel(data.model);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-full flex-col gap-2">
      {content ? (
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-200">
          {content}
        </p>
      ) : (
        <p className="text-sm text-slate-400 dark:text-slate-500">
          Сводка ещё не сгенерирована.
        </p>
      )}

      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}

      <div className="mt-auto flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={generate}
          disabled={loading || !hasReports}
          title={!hasReports ? "Нет отчётов за эту неделю" : undefined}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
        >
          {loading
            ? "Генерация…"
            : content
              ? "Обновить сводку"
              : "Сгенерировать сводку"}
        </button>
        {model && (
          <span className="text-[10px] text-slate-400" title={model}>
            {model.split("/").pop()?.replace(":free", "")}
          </span>
        )}
      </div>
    </div>
  );
}

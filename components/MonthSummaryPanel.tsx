"use client";

import { useState } from "react";
import Markdown from "@/components/Markdown";
import EmailSummaryButton from "@/components/EmailSummaryButton";

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
    <div className="rounded-xl border border-cream-ink/15 bg-cream/50 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold text-cream-ink">AI-итоги месяца</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={generate}
            disabled={loading || !hasReports}
            title={!hasReports ? "За этот месяц нет отчётов" : undefined}
            className="btn btn-primary btn-sm"
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
              className="btn btn-ghost btn-sm"
              title="Скачать месяц в Markdown"
            >
              .md
            </a>
          )}
          {content && (
            <a
              href={`/api/export?month=${month}&format=docx`}
              className="btn btn-ghost btn-sm"
              title="Скачать месяц в Word (.docx)"
            >
              .docx
            </a>
          )}
          {content && (
            <EmailSummaryButton
              subject="AI-итоги месяца — hi-team"
              content={content}
            />
          )}
        </div>
      </div>

      {error && <p className="mt-2 text-xs text-danger">{error}</p>}

      {content ? (
        <>
          <div className="mt-3">
            <Markdown>{content}</Markdown>
          </div>
          {generatedAt && (
            <p className="mt-2 text-[11px] text-faint">
              Сгенерировано: {generatedAt}
            </p>
          )}
        </>
      ) : (
        <p className="mt-3 text-sm text-muted">
          Агрегированные итоги месяца по всем отчётам и недельным сводкам —
          для отчётности наверх.
        </p>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import Markdown from "@/components/Markdown";

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
    <div className="rounded-xl border border-cream-ink/15 bg-cream/50 p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold text-cream-ink">AI-статус проекта</h2>
        <button
          type="button"
          onClick={generate}
          disabled={loading || !hasEntries}
          title={!hasEntries ? "По проекту нет упоминаний в отчётах" : undefined}
          className="btn btn-primary btn-sm"
        >
          {loading
            ? "Генерация…"
            : content
              ? "Обновить статус"
              : "Сгенерировать статус"}
        </button>
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
          Сводка по проекту за последние недели — для отчётности наверх.
        </p>
      )}
    </div>
  );
}

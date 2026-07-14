"use client";

import { useRef, useState } from "react";
import Markdown from "@/components/Markdown";
import EmailSummaryButton from "@/components/EmailSummaryButton";

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
  const [copied, setCopied] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  async function copy() {
    // Копируем видимый текст как plain text (без разметки таблицы/Markdown).
    const text = bodyRef.current?.innerText ?? content;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Не удалось скопировать");
    }
  }

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
        <div ref={bodyRef}>
          <Markdown>{content}</Markdown>
        </div>
      ) : (
        <p className="text-sm text-faint">Сводка ещё не сгенерирована.</p>
      )}

      {error && <p className="text-xs text-danger">{error}</p>}

      <div className="mt-auto flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={generate}
          disabled={loading || !hasReports}
          title={!hasReports ? "Нет отчётов за эту неделю" : undefined}
          className="btn btn-primary btn-sm"
        >
          {loading
            ? "Генерация…"
            : content
              ? "Обновить сводку"
              : "Сгенерировать сводку"}
        </button>
        {content && (
          <button
            type="button"
            onClick={copy}
            className="btn btn-ghost btn-sm"
            title="Скопировать сводку как обычный текст"
          >
            {copied ? "Скопировано ✓" : "Копировать"}
          </button>
        )}
        {model && (
          <span className="text-[10px] text-faint" title={model}>
            {model.split("/").pop()?.replace(":free", "")}
          </span>
        )}
      </div>

      {content && (
        <EmailSummaryButton subject="AI-сводка недели — hi-team" content={content} />
      )}
    </div>
  );
}

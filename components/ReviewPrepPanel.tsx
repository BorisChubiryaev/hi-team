"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import Markdown from "@/components/Markdown";
import { sendReviewToTelegram } from "@/app/review/actions";

export default function ReviewPrepPanel({
  start,
  end,
  label,
  initialContent,
  initialFocus,
  initialGeneratedAt,
  hasData,
  telegramConnected,
}: {
  start: string;
  end: string;
  label: string;
  initialContent: string | null;
  initialFocus: string;
  initialGeneratedAt: string | null;
  hasData: boolean;
  telegramConnected: boolean;
}) {
  const [focus, setFocus] = useState(initialFocus);
  const [content, setContent] = useState(initialContent ?? "");
  const [generatedAt, setGeneratedAt] = useState(initialGeneratedAt ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [tgState, setTgState] = useState<"idle" | "sent">("idle");
  const [tgPending, startTg] = useTransition();

  function sendToTelegram() {
    setError("");
    setTgState("idle");
    startTg(async () => {
      const res = await sendReviewToTelegram(label, content);
      if (res.ok) {
        setTgState("sent");
        setTimeout(() => setTgState("idle"), 3000);
      } else {
        setError(res.error);
      }
    });
  }

  async function generate() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ start, end, label, focus }),
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

  async function copy() {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Не удалось скопировать");
    }
  }

  function download() {
    const blob = new Blob([`# Подготовка к встрече — ${label}\n\n${content}`], {
      type: "text/markdown;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `review-${start}_${end}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="card p-5">
      <label className="block">
        <span className="text-sm font-medium text-ink">
          Личный акцент{" "}
          <span className="font-normal text-muted">(необязательно)</span>
        </span>
        <p className="mb-1.5 mt-0.5 text-xs text-muted">
          Чего хотите добиться на встрече — AI расставит акценты. Напр.: «иду на
          повышение, подчеркни лидерство» или «хочу больше задач по аналитике».
        </p>
        <textarea
          value={focus}
          onChange={(e) => setFocus(e.target.value)}
          rows={2}
          maxLength={500}
          placeholder="Например: хочу показать вклад в проект X и попросить наставничество"
          className="input resize-y"
        />
      </label>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={generate}
          disabled={loading || !hasData}
          title={!hasData ? "За этот период у вас нет отчётов" : undefined}
          className="btn btn-primary"
        >
          {loading
            ? "Готовлю…"
            : content
              ? "Пересобрать"
              : "Собрать материалы к встрече"}
        </button>
        {content && (
          <>
            <button type="button" onClick={copy} className="btn btn-ghost btn-sm">
              {copied ? "Скопировано ✓" : "Копировать"}
            </button>
            <button
              type="button"
              onClick={download}
              className="btn btn-ghost btn-sm"
            >
              Скачать .md
            </button>
            {telegramConnected ? (
              <button
                type="button"
                onClick={sendToTelegram}
                disabled={tgPending}
                className="btn btn-ghost btn-sm"
              >
                {tgPending
                  ? "Отправляю…"
                  : tgState === "sent"
                    ? "Отправлено в Telegram ✓"
                    : "В Telegram"}
              </button>
            ) : (
              <Link href="/settings" className="btn btn-ghost btn-sm">
                Подключить Telegram
              </Link>
            )}
          </>
        )}
        {generatedAt && !loading && (
          <span className="text-xs text-faint">Обновлено: {generatedAt}</span>
        )}
      </div>

      {error && (
        <p className="mt-2 text-sm text-danger">{error}</p>
      )}

      {content ? (
        <div className="mt-5 border-t border-line pt-4">
          <Markdown>{content}</Markdown>
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted">
          {hasData
            ? "Нажмите «Собрать материалы» — AI подготовит по вашим отчётам достижения, вклад по проектам, преодолённые сложности и темы для разговора с руководителем."
            : "За выбранный период у вас нет отчётов. Выберите другой период выше."}
        </p>
      )}
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createTelegramLink, unlinkTelegram } from "@/app/settings/actions";

export default function TelegramConnect({
  connected,
  username,
}: {
  connected: boolean;
  username: string | null;
}) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function connect() {
    setError("");
    startTransition(async () => {
      const res = await createTelegramLink();
      if (res.ok) setUrl(res.url);
      else setError(res.error);
    });
  }

  function disconnect() {
    startTransition(async () => {
      await unlinkTelegram();
      setUrl("");
      router.refresh();
    });
  }

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-ink">Telegram-бот</h2>
          <p className="mt-0.5 text-sm text-muted">
            Напоминания и отправка отчёта прямо из чата.
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            connected
              ? "bg-success-bg text-success"
              : "bg-panel text-muted"
          }`}
        >
          {connected ? "Подключён" : "Не подключён"}
        </span>
      </div>

      {connected ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className="text-sm text-muted">
            {username ? `@${username}` : "Аккаунт привязан"}. В боте: /report — отправить отчёт, /status — проверить.
          </span>
          <button
            type="button"
            onClick={disconnect}
            disabled={pending}
            className="rounded-full border border-line px-3 py-1.5 text-sm text-danger transition hover:bg-danger-bg disabled:opacity-50"
          >
            Отвязать
          </button>
        </div>
      ) : (
        <div className="mt-4">
          {url ? (
            <div className="space-y-2">
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary"
              >
                Открыть бота и подтвердить →
              </a>
              <p className="text-xs text-muted">
                Нажмите ссылку, затем в Telegram — кнопку «Запустить»/Start.
                Ссылка действует 15 минут. После привязки обновите страницу.
              </p>
            </div>
          ) : (
            <button
              type="button"
              onClick={connect}
              disabled={pending}
              className="btn btn-primary"
            >
              {pending ? "Готовлю ссылку…" : "Подключить Telegram"}
            </button>
          )}
          {error && <p className="mt-2 text-sm text-danger">{error}</p>}
        </div>
      )}
    </div>
  );
}

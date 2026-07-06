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
    <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-slate-900 dark:text-white">
            Telegram-бот
          </h2>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            Напоминания и отправка отчёта прямо из чата.
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            connected
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
              : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
          }`}
        >
          {connected ? "Подключён" : "Не подключён"}
        </span>
      </div>

      {connected ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className="text-sm text-slate-600 dark:text-slate-300">
            {username ? `@${username}` : "Аккаунт привязан"}. В боте: /report — отправить отчёт, /status — проверить.
          </span>
          <button
            type="button"
            onClick={disconnect}
            disabled={pending}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-red-600 transition hover:bg-red-50 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-red-950"
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
                className="inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
              >
                Открыть бота и подтвердить →
              </a>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Нажмите ссылку, затем в Telegram — кнопку «Запустить»/Start.
                Ссылка действует 15 минут. После привязки обновите страницу.
              </p>
            </div>
          ) : (
            <button
              type="button"
              onClick={connect}
              disabled={pending}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
            >
              {pending ? "Готовлю ссылку…" : "Подключить Telegram"}
            </button>
          )}
          {error && (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

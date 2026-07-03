"use client";

import { useState, useTransition } from "react";
import { addAllowedEmail, removeAllowedEmail } from "@/app/admin/actions";

export default function AllowlistManager({
  emails,
  usingEnvFallback,
}: {
  emails: { id: string; email: string }[];
  usingEnvFallback: boolean;
}) {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function onAdd() {
    setError("");
    startTransition(async () => {
      const res = await addAllowedEmail(value);
      if (!res.ok) setError(res.error);
      else setValue("");
    });
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <h2 className="font-semibold text-slate-900 dark:text-white">
        Кому разрешён вход
      </h2>
      {usingEnvFallback && (
        <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          Список пуст — сейчас действует allowlist из переменной окружения
          ALLOWED_EMAILS. Добавьте сюда почты команды, чтобы управлять доступом
          без redeploy (env перестанет учитываться).
        </p>
      )}

      <ul className="mt-3 space-y-1.5">
        {emails.map((e) => (
          <li
            key={e.id}
            className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700 dark:bg-slate-950 dark:text-slate-200"
          >
            {e.email}
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  await removeAllowedEmail(e.id);
                })
              }
              className="text-xs text-red-600 hover:underline disabled:opacity-40 dark:text-red-400"
            >
              Убрать
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="email@company.ru"
          type="email"
          className="w-full max-w-xs rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
          aria-label="Почта для доступа"
        />
        <button
          type="button"
          onClick={onAdd}
          disabled={pending || !value.trim()}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
        >
          Добавить
        </button>
      </div>
      {error && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
      <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
        Удаление почты не блокирует уже созданного пользователя — для этого
        деактивируйте его в таблице выше.
      </p>
    </div>
  );
}

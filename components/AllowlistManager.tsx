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
    <div className="card p-5">
      <h2 className="font-semibold text-ink">Кому разрешён вход</h2>
      {usingEnvFallback && (
        <p className="mt-2 rounded-lg border border-warn/25 bg-warn-bg px-3 py-2 text-xs text-warn">
          Список пуст — сейчас действует allowlist из переменной окружения
          ALLOWED_EMAILS. Добавьте сюда почты команды, чтобы управлять доступом
          без redeploy (env перестанет учитываться).
        </p>
      )}

      <ul className="mt-3 space-y-1.5">
        {emails.map((e) => (
          <li
            key={e.id}
            className="flex items-center justify-between gap-3 rounded-lg bg-panel px-3 py-2 text-sm text-ink"
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
              className="text-xs text-danger hover:underline disabled:opacity-40"
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
          className="input max-w-xs"
          aria-label="Почта для доступа"
        />
        <button
          type="button"
          onClick={onAdd}
          disabled={pending || !value.trim()}
          className="btn btn-primary"
        >
          Добавить
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      <p className="mt-3 text-xs text-muted">
        Удаление почты не блокирует уже созданного пользователя — для этого
        деактивируйте его в таблице выше.
      </p>
    </div>
  );
}

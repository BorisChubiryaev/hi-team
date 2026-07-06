"use client";

import { useState, useTransition } from "react";
import type { Role } from "@prisma/client";
import {
  setUserActive,
  setUserRole,
  setUserTelegram,
} from "@/app/admin/actions";

export default function AdminUserRow({
  user,
  isSelf,
}: {
  user: {
    id: string;
    name: string | null;
    email: string;
    role: Role;
    active: boolean;
    telegramChatId: string | null;
  };
  isSelf: boolean;
}) {
  const [telegram, setTelegram] = useState(user.telegramChatId ?? "");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    setError("");
    startTransition(async () => {
      const res = await action();
      if (!res.ok) setError(res.error);
    });
  }

  const inputClass =
    "rounded-lg border border-line bg-card px-2 py-1.5 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:opacity-60";

  return (
    <tr
      className={`border-b border-line last:border-b-0 ${
        user.active ? "" : "opacity-50"
      }`}
    >
      <td className="p-3">
        <p className="font-medium text-ink">
          {user.name ?? "—"}
          {isSelf && (
            <span className="ml-1.5 text-xs font-normal text-faint">(вы)</span>
          )}
        </p>
        <p className="text-xs text-muted">{user.email}</p>
        {error && <p className="mt-1 text-xs text-danger">{error}</p>}
      </td>
      <td className="p-3">
        <select
          value={user.role}
          disabled={pending}
          onChange={(e) => run(() => setUserRole(user.id, e.target.value as Role))}
          className={inputClass}
          aria-label="Роль"
        >
          <option value="MEMBER">Сотрудник</option>
          <option value="LEAD">Руководитель</option>
        </select>
      </td>
      <td className="p-3">
        <label className="inline-flex items-center gap-2 text-sm text-muted">
          <input
            type="checkbox"
            checked={user.active}
            disabled={pending || isSelf}
            onChange={(e) => run(() => setUserActive(user.id, e.target.checked))}
            className="h-4 w-4 accent-[var(--accent)]"
          />
          {user.active ? "Активен" : "Деактивирован"}
        </label>
      </td>
      <td className="p-3">
        <div className="flex items-center gap-1.5">
          <input
            value={telegram}
            onChange={(e) => setTelegram(e.target.value)}
            placeholder="chat_id"
            className={`${inputClass} w-32`}
            aria-label="Telegram chat_id"
          />
          <button
            type="button"
            disabled={pending || telegram === (user.telegramChatId ?? "")}
            onClick={() => run(() => setUserTelegram(user.id, telegram))}
            className="rounded-full px-2 py-1.5 text-xs font-medium text-accent transition hover:bg-cream disabled:opacity-40"
          >
            Сохранить
          </button>
        </div>
      </td>
    </tr>
  );
}

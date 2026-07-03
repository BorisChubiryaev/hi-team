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
    "rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-700 outline-none focus:border-blue-500 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200";

  return (
    <tr
      className={`border-b border-slate-200 last:border-b-0 dark:border-slate-800 ${
        user.active ? "" : "opacity-50"
      }`}
    >
      <td className="p-3">
        <p className="font-medium text-slate-900 dark:text-white">
          {user.name ?? "—"}
          {isSelf && (
            <span className="ml-1.5 text-xs font-normal text-slate-400">
              (вы)
            </span>
          )}
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {user.email}
        </p>
        {error && (
          <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>
        )}
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
        <label className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          <input
            type="checkbox"
            checked={user.active}
            disabled={pending || isSelf}
            onChange={(e) => run(() => setUserActive(user.id, e.target.checked))}
            className="h-4 w-4"
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
            className="rounded-md px-2 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 disabled:opacity-40 dark:text-blue-400 dark:hover:bg-blue-950"
          >
            Сохранить
          </button>
        </div>
      </td>
    </tr>
  );
}

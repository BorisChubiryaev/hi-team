"use client";

import { useState, useTransition } from "react";
import type { Role, Subteam } from "@prisma/client";
import {
  deleteUser,
  setUserActive,
  setUserRole,
  setUserSubteam,
  setUserTelegram,
  setUserVacation,
} from "@/app/admin/actions";
import { ROLE_LABELS } from "@/lib/roles";
import { SUBTEAMS, subteamTag } from "@/lib/subteam";

const ROLE_OPTIONS: Role[] = ["MEMBER", "LEAD", "DIRECTOR"];

/** Date | ISO-строка | null → значение для <input type="date"> (YYYY-MM-DD). */
function toDateInput(v: Date | string | null): string {
  if (!v) return "";
  const d = typeof v === "string" ? new Date(v) : v;
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

export default function AdminUserRow({
  user,
  isSelf,
}: {
  user: {
    id: string;
    name: string | null;
    email: string;
    role: Role;
    subteam: Subteam | null;
    active: boolean;
    telegramChatId: string | null;
    vacationUntil: Date | string | null;
  };
  isSelf: boolean;
}) {
  const [telegram, setTelegram] = useState(user.telegramChatId ?? "");
  const [vacation, setVacation] = useState(toDateInput(user.vacationUntil));
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    setError("");
    startTransition(async () => {
      const res = await action();
      if (!res.ok) setError(res.error);
    });
  }

  function onDelete() {
    if (
      !window.confirm(
        `Удалить ${user.name ?? user.email} из команды? Вместе с пользователем удалятся все его отчёты — действие необратимо. Чтобы сохранить историю, вместо удаления снимите галочку «Активен».`,
      )
    ) {
      return;
    }
    run(() => deleteUser(user.id));
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
        {!isSelf && (
          <button
            type="button"
            onClick={onDelete}
            disabled={pending}
            className="mt-1 text-xs text-danger transition hover:underline disabled:opacity-40"
          >
            Удалить из команды
          </button>
        )}
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
          {ROLE_OPTIONS.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
      </td>
      <td className="p-3">
        <select
          value={user.subteam ?? ""}
          disabled={pending}
          onChange={(e) => run(() => setUserSubteam(user.id, e.target.value))}
          className={inputClass}
          aria-label="Подкоманда"
        >
          <option value="">—</option>
          {SUBTEAMS.map((s) => (
            <option key={s} value={s}>
              {subteamTag(s)}
            </option>
          ))}
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
      <td className="p-3">
        <div className="flex items-center gap-1.5">
          <input
            type="date"
            value={vacation}
            onChange={(e) => setVacation(e.target.value)}
            className={`${inputClass} w-36`}
            aria-label="В отпуске до"
          />
          <button
            type="button"
            disabled={pending || vacation === toDateInput(user.vacationUntil)}
            onClick={() => run(() => setUserVacation(user.id, vacation))}
            className="rounded-full px-2 py-1.5 text-xs font-medium text-accent transition hover:bg-cream disabled:opacity-40"
          >
            Сохранить
          </button>
        </div>
      </td>
    </tr>
  );
}

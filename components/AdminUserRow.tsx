"use client";

import { useState, useTransition } from "react";
import type { Role } from "@prisma/client";
import {
  deleteUser,
  endUserVacation,
  setUserActive,
  setUserRole,
  setUserTelegram,
  setUserVacation,
} from "@/app/admin/actions";
import { ROLE_LABELS } from "@/lib/roles";

const ROLE_OPTIONS: Role[] = ["MEMBER", "LEAD", "DIRECTOR"];

export default function AdminUserRow({
  user,
  isSelf,
  vacation,
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
  vacation: { label: string; started: boolean } | null;
}) {
  const [telegram, setTelegram] = useState(user.telegramChatId ?? "");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const [vacFrom, setVacFrom] = useState<"current" | "next">("next");
  const [vacWeeks, setVacWeeks] = useState("1");

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
        {vacation ? (
          <div className="text-sm">
            <p className="whitespace-nowrap text-ink">🏖 {vacation.label}</p>
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => endUserVacation(user.id))}
              className="mt-1 text-xs text-danger transition hover:underline disabled:opacity-40"
            >
              {vacation.started ? "Завершить досрочно" : "Отменить"}
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-1.5">
            <select
              value={vacFrom}
              disabled={pending}
              onChange={(e) => setVacFrom(e.target.value as "current" | "next")}
              className={inputClass}
              aria-label="Отпуск с недели"
            >
              <option value="current">с текущей</option>
              <option value="next">со следующей</option>
            </select>
            <select
              value={vacWeeks}
              disabled={pending}
              onChange={(e) => setVacWeeks(e.target.value)}
              className={inputClass}
              aria-label="Срок отпуска"
            >
              <option value="1">1 нед.</option>
              <option value="2">2 нед.</option>
              <option value="3">3 нед.</option>
              <option value="4">4 нед.</option>
              <option value="open">открытый</option>
            </select>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                run(() =>
                  setUserVacation(
                    user.id,
                    vacFrom,
                    vacWeeks === "open" ? null : Number(vacWeeks),
                  ),
                )
              }
              className="rounded-full px-2 py-1.5 text-xs font-medium text-accent transition hover:bg-cream disabled:opacity-40"
            >
              В отпуск
            </button>
          </div>
        )}
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

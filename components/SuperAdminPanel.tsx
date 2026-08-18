"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Role } from "@prisma/client";
import { ROLE_LABELS } from "@/lib/roles";
import {
  addAllowedEmailToWorkspace,
  createWorkspace,
  removeAllowedEmail,
  renameWorkspace,
  saSetUserRole,
  setUserSuperAdmin,
  setUserWorkspace,
} from "@/app/superadmin/actions";

type Workspace = {
  id: string;
  name: string;
  slug: string;
  members: number;
  allowed: number;
};
type UserRow = {
  id: string;
  name: string | null;
  email: string;
  workspaceId: string | null;
  role: Role;
  isSuperAdmin: boolean;
};
type Allowed = { id: string; email: string; workspaceId: string | null };

const ROLES: Role[] = ["MEMBER", "LEAD", "DIRECTOR"];
const selectClass =
  "rounded-lg border border-line bg-card px-2.5 py-1.5 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:opacity-50";

export default function SuperAdminPanel({
  workspaces,
  users,
  allowed,
}: {
  workspaces: Workspace[];
  users: UserRow[];
  allowed: Allowed[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const [newWs, setNewWs] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [emailWs, setEmailWs] = useState(workspaces[0]?.id ?? "");

  function run(action: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    setError("");
    startTransition(async () => {
      const res = await action();
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  }

  const wsName = (id: string | null) =>
    id ? (workspaces.find((w) => w.id === id)?.name ?? "—") : "—";

  return (
    <div className="space-y-10">
      {error && (
        <p className="rounded-lg border border-danger/25 bg-danger-bg px-4 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      {/* Команды */}
      <section>
        <h2 className="text-lg font-semibold text-ink">Команды</h2>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            value={newWs}
            onChange={(e) => setNewWs(e.target.value)}
            placeholder="Название новой команды"
            className={`${selectClass} w-64`}
          />
          <button
            type="button"
            disabled={pending || !newWs.trim()}
            onClick={() =>
              run(async () => {
                const r = await createWorkspace(newWs);
                if (r.ok) setNewWs("");
                return r;
              })
            }
            className="btn btn-primary"
          >
            Создать команду
          </button>
        </div>

        <div className="mt-4 overflow-x-auto rounded-xl border border-line-strong">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-panel">
                <Th>Команда</Th>
                <Th>slug</Th>
                <Th>Людей</Th>
                <Th>В allowlist</Th>
              </tr>
            </thead>
            <tbody>
              {workspaces.map((w) => (
                <tr key={w.id} className="border-b border-line last:border-b-0">
                  <td className="p-3">
                    <input
                      defaultValue={w.name}
                      disabled={pending}
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v && v !== w.name) run(() => renameWorkspace(w.id, v));
                      }}
                      className={`${selectClass} w-56`}
                      aria-label="Название команды"
                    />
                  </td>
                  <td className="p-3 font-mono text-xs text-muted">{w.slug}</td>
                  <td className="p-3 tabular-nums">{w.members}</td>
                  <td className="p-3 tabular-nums">{w.allowed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Люди */}
      <section>
        <h2 className="text-lg font-semibold text-ink">Люди</h2>
        <p className="mt-0.5 text-sm text-muted">
          Команда, роль и супер-админ. Роль здесь без ограничения «последнего
          управляющего».
        </p>
        <div className="mt-3 overflow-x-auto rounded-xl border border-line-strong">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-panel">
                <Th>Сотрудник</Th>
                <Th>Команда</Th>
                <Th>Роль</Th>
                <Th>Супер-админ</Th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-line last:border-b-0">
                  <td className="p-3">
                    <p className="font-medium text-ink">{u.name ?? "—"}</p>
                    <p className="text-xs text-muted">{u.email}</p>
                  </td>
                  <td className="p-3">
                    <select
                      value={u.workspaceId ?? ""}
                      disabled={pending}
                      onChange={(e) => run(() => setUserWorkspace(u.id, e.target.value))}
                      className={selectClass}
                      aria-label="Команда"
                    >
                      <option value="">— без команды</option>
                      {workspaces.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="p-3">
                    <select
                      value={u.role}
                      disabled={pending}
                      onChange={(e) => run(() => saSetUserRole(u.id, e.target.value as Role))}
                      className={selectClass}
                      aria-label="Роль"
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="p-3">
                    <input
                      type="checkbox"
                      checked={u.isSuperAdmin}
                      disabled={pending}
                      onChange={(e) => run(() => setUserSuperAdmin(u.id, e.target.checked))}
                      className="h-4 w-4 accent-[var(--accent)]"
                      aria-label="Супер-админ"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Allowlist по командам */}
      <section>
        <h2 className="text-lg font-semibold text-ink">Доступ по командам</h2>
        <p className="mt-0.5 text-sm text-muted">
          Почта → команда: новый человек при первом входе попадёт в выбранную
          команду.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="name@company.ru"
            className={`${selectClass} w-64`}
          />
          <select
            value={emailWs}
            disabled={pending}
            onChange={(e) => setEmailWs(e.target.value)}
            className={selectClass}
            aria-label="Команда для почты"
          >
            {workspaces.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={pending || !newEmail.trim() || !emailWs}
            onClick={() =>
              run(async () => {
                const r = await addAllowedEmailToWorkspace(emailWs, newEmail);
                if (r.ok) setNewEmail("");
                return r;
              })
            }
            className="btn btn-primary"
          >
            Добавить
          </button>
        </div>

        {allowed.length > 0 && (
          <div className="mt-4 overflow-x-auto rounded-xl border border-line-strong">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-panel">
                  <Th>Почта</Th>
                  <Th>Команда</Th>
                  <Th></Th>
                </tr>
              </thead>
              <tbody>
                {allowed.map((a) => (
                  <tr key={a.id} className="border-b border-line last:border-b-0">
                    <td className="p-3">{a.email}</td>
                    <td className="p-3 text-muted">{wsName(a.workspaceId)}</td>
                    <td className="p-3 text-right">
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => run(() => removeAllowedEmail(a.id))}
                        className="text-xs text-danger transition hover:underline disabled:opacity-40"
                      >
                        Удалить
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Th({ children }: { children?: React.ReactNode }) {
  return (
    <th className="border-b border-line-strong p-3 text-left font-semibold text-ink">
      {children}
    </th>
  );
}

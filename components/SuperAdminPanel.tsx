"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Role } from "@prisma/client";
import { ROLE_LABELS } from "@/lib/roles";
import {
  addAllowedEmailToWorkspace,
  addSubteam,
  createWorkspace,
  removeAllowedEmail,
  removeSubteam,
  renameWorkspace,
  saSetUserRole,
  setAllowedEmailRole,
  setUserSuperAdmin,
  setUserWorkspace,
  setWorkspacePrompts,
} from "@/app/superadmin/actions";

type Subteam = { id: string; key: string; label: string; workspaceId: string };

type Workspace = {
  id: string;
  name: string;
  slug: string;
  members: number;
  allowed: number;
  weekPrompt: string | null;
  monthPrompt: string | null;
};
type UserRow = {
  id: string;
  name: string | null;
  email: string;
  workspaceId: string | null;
  role: Role;
  isSuperAdmin: boolean;
};
type Allowed = {
  id: string;
  email: string;
  workspaceId: string | null;
  role: Role;
};

const ROLES: Role[] = ["MEMBER", "LEAD", "DIRECTOR"];
const selectClass =
  "rounded-lg border border-line bg-card px-2.5 py-1.5 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:opacity-50";

export default function SuperAdminPanel({
  workspaces,
  users,
  allowed,
  subteams,
}: {
  workspaces: Workspace[];
  users: UserRow[];
  allowed: Allowed[];
  subteams: Subteam[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const [newWs, setNewWs] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [emailWs, setEmailWs] = useState(workspaces[0]?.id ?? "");
  const [emailRole, setEmailRole] = useState<Role>("MEMBER");

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

      {/* Подкоманды по командам */}
      <SubteamsSection
        workspaces={workspaces}
        subteams={subteams}
        pending={pending}
        onAdd={(wsId, key, label) => run(() => addSubteam(wsId, key, label))}
        onRemove={(id) => run(() => removeSubteam(id))}
      />

      {/* Промпты AI-сводок */}
      <PromptsSection
        workspaces={workspaces}
        pending={pending}
        onSave={(id, w, m) => run(() => setWorkspacePrompts(id, w, m))}
      />

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
          Почта → команда и роль: новый человек при первом входе попадёт в
          выбранную команду с этой ролью.
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
          <select
            value={emailRole}
            disabled={pending}
            onChange={(e) => setEmailRole(e.target.value as Role)}
            className={selectClass}
            aria-label="Роль для почты"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={pending || !newEmail.trim() || !emailWs}
            onClick={() =>
              run(async () => {
                const r = await addAllowedEmailToWorkspace(
                  emailWs,
                  newEmail,
                  emailRole,
                );
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
                  <Th>Роль при входе</Th>
                  <Th></Th>
                </tr>
              </thead>
              <tbody>
                {allowed.map((a) => (
                  <tr key={a.id} className="border-b border-line last:border-b-0">
                    <td className="p-3">{a.email}</td>
                    <td className="p-3 text-muted">{wsName(a.workspaceId)}</td>
                    <td className="p-3">
                      <select
                        value={a.role}
                        disabled={pending}
                        onChange={(e) =>
                          run(() =>
                            setAllowedEmailRole(a.id, e.target.value as Role),
                          )
                        }
                        className={selectClass}
                        aria-label="Роль при первом входе"
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {ROLE_LABELS[r]}
                          </option>
                        ))}
                      </select>
                    </td>
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

function SubteamsSection({
  workspaces,
  subteams,
  pending,
  onAdd,
  onRemove,
}: {
  workspaces: Workspace[];
  subteams: Subteam[];
  pending: boolean;
  onAdd: (workspaceId: string, key: string, label: string) => void;
  onRemove: (id: string) => void;
}) {
  const [wsId, setWsId] = useState(workspaces[0]?.id ?? "");
  const [key, setKey] = useState("");
  const [label, setLabel] = useState("");
  const list = subteams.filter((s) => s.workspaceId === wsId);

  return (
    <section>
      <h2 className="text-lg font-semibold text-ink">Подкоманды по командам</h2>
      <p className="mt-0.5 text-sm text-muted">
        Направления внутри команды (тег для бейджа + название). По ним делится
        AI-сводка и группируется дашборд. У каждой команды свой набор.
      </p>
      <select
        value={wsId}
        disabled={pending}
        onChange={(e) => setWsId(e.target.value)}
        className={`${selectClass} mt-3`}
        aria-label="Команда"
      >
        {workspaces.map((w) => (
          <option key={w.id} value={w.id}>
            {w.name}
          </option>
        ))}
      </select>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {list.map((s) => (
          <span
            key={s.id}
            className="inline-flex items-center gap-1.5 rounded-full bg-cream px-2.5 py-1 text-xs text-cream-ink"
          >
            <span className="font-mono font-medium">#{s.key}</span>
            <span className="text-cream-ink/70">{s.label}</span>
            <button
              type="button"
              disabled={pending}
              onClick={() => onRemove(s.id)}
              className="text-danger transition hover:opacity-70 disabled:opacity-40"
              aria-label="Удалить подкоманду"
            >
              ✕
            </button>
          </span>
        ))}
        {list.length === 0 && (
          <span className="text-sm text-faint">Пока нет подкоманд.</span>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="Тег (напр. DS)"
          className={`${selectClass} w-32`}
        />
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Название (напр. Data Science)"
          className={`${selectClass} w-56`}
        />
        <button
          type="button"
          disabled={pending || !wsId || !key.trim()}
          onClick={() => {
            onAdd(wsId, key, label);
            setKey("");
            setLabel("");
          }}
          className="btn btn-primary"
        >
          Добавить
        </button>
      </div>
    </section>
  );
}

function PromptsSection({
  workspaces,
  pending,
  onSave,
}: {
  workspaces: Workspace[];
  pending: boolean;
  onSave: (id: string, weekPrompt: string, monthPrompt: string) => void;
}) {
  const [wsId, setWsId] = useState(workspaces[0]?.id ?? "");
  const current = workspaces.find((w) => w.id === wsId);

  return (
    <section>
      <h2 className="text-lg font-semibold text-ink">Промпты AI-сводок</h2>
      <p className="mt-0.5 text-sm text-muted">
        Системные промпты недельной и месячной сводки для команды. Пусто =
        дефолтный промпт из кода.
      </p>
      <select
        value={wsId}
        disabled={pending}
        onChange={(e) => setWsId(e.target.value)}
        className={`${selectClass} mt-3`}
        aria-label="Команда"
      >
        {workspaces.map((w) => (
          <option key={w.id} value={w.id}>
            {w.name}
          </option>
        ))}
      </select>

      {current && (
        <PromptForm
          key={current.id}
          weekPrompt={current.weekPrompt ?? ""}
          monthPrompt={current.monthPrompt ?? ""}
          pending={pending}
          onSave={(w, m) => onSave(current.id, w, m)}
        />
      )}
    </section>
  );
}

function PromptForm({
  weekPrompt: initWeek,
  monthPrompt: initMonth,
  pending,
  onSave,
}: {
  weekPrompt: string;
  monthPrompt: string;
  pending: boolean;
  onSave: (weekPrompt: string, monthPrompt: string) => void;
}) {
  const [week, setWeek] = useState(initWeek);
  const [month, setMonth] = useState(initMonth);
  const changed = week !== initWeek || month !== initMonth;
  const taClass =
    "mt-1 min-h-32 w-full resize-y rounded-lg border border-line bg-card px-3 py-2 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20";

  return (
    <div className="mt-4 space-y-4">
      <label className="block">
        <span className="text-xs font-medium uppercase tracking-wide text-faint">
          Промпт недельной сводки
        </span>
        <textarea
          value={week}
          onChange={(e) => setWeek(e.target.value)}
          placeholder="Пусто — используется дефолтный промпт"
          className={taClass}
        />
      </label>
      <label className="block">
        <span className="text-xs font-medium uppercase tracking-wide text-faint">
          Промпт месячных итогов
        </span>
        <textarea
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          placeholder="Пусто — используется дефолтный промпт"
          className={taClass}
        />
      </label>
      <button
        type="button"
        disabled={pending || !changed}
        onClick={() => onSave(week, month)}
        className="btn btn-primary"
      >
        Сохранить промпты
      </button>
    </div>
  );
}

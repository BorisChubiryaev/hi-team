"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ProjectStatus } from "@prisma/client";

type Overrides = {
  weeks?: number;
  all?: boolean;
  user?: string;
  project?: string;
  status?: string;
};

export default function AnalyticsFilters({
  users,
  projects,
  weeks,
  all,
  userId,
  projectId,
  status,
}: {
  users: { id: string; label: string }[];
  projects: { id: string; name: string }[];
  weeks: number;
  all: boolean;
  userId?: string;
  projectId?: string;
  status?: ProjectStatus;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [weeksInput, setWeeksInput] = useState(String(weeks));

  function navigate(next: Overrides) {
    const merged = {
      weeks,
      all,
      user: userId,
      project: projectId,
      status,
      ...next,
    };
    const qs = new URLSearchParams();
    if (merged.all) qs.set("all", "1");
    else if (merged.weeks && merged.weeks !== 12)
      qs.set("weeks", String(merged.weeks));
    if (merged.user) qs.set("user", merged.user);
    if (merged.project) qs.set("project", merged.project);
    if (merged.status) qs.set("status", merged.status);
    const s = qs.toString();
    startTransition(() => router.push(s ? `/analytics?${s}` : "/analytics"));
  }

  function applyWeeks() {
    const n = Math.max(1, Math.min(520, Math.floor(Number(weeksInput) || 12)));
    setWeeksInput(String(n));
    if (n !== weeks || all) navigate({ weeks: n, all: false });
  }

  const selectClass =
    "rounded-lg border border-line bg-card px-2.5 py-1.5 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:opacity-50";

  return (
    <div className="mb-4 flex flex-wrap items-end gap-x-4 gap-y-3">
      <Labelled label="Сотрудник">
        <select
          className={selectClass}
          value={userId ?? ""}
          disabled={pending}
          onChange={(e) => navigate({ user: e.target.value || undefined })}
          aria-label="Фильтр по сотруднику"
        >
          <option value="">Вся команда</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.label}
            </option>
          ))}
        </select>
      </Labelled>

      <Labelled label="Проект">
        <select
          className={selectClass}
          value={projectId ?? ""}
          disabled={pending}
          onChange={(e) => navigate({ project: e.target.value || undefined })}
          aria-label="Фильтр по проекту"
        >
          <option value="">Все проекты</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </Labelled>

      <Labelled label="Статус проекта">
        <select
          className={selectClass}
          value={status ?? ""}
          disabled={pending || Boolean(projectId)}
          onChange={(e) => navigate({ status: e.target.value || undefined })}
          aria-label="Фильтр по статусу проекта"
        >
          <option value="">Любой</option>
          <option value="ACTIVE">Активные</option>
          <option value="PAUSED">На паузе</option>
          <option value="DONE">Завершённые</option>
        </select>
      </Labelled>

      <Labelled label="Период, недель">
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={1}
            max={520}
            value={weeksInput}
            disabled={pending || all}
            onChange={(e) => setWeeksInput(e.target.value)}
            onBlur={applyWeeks}
            onKeyDown={(e) => {
              if (e.key === "Enter") applyWeeks();
            }}
            className={`w-20 ${selectClass}`}
            aria-label="Число недель"
          />
          <label className="inline-flex items-center gap-1.5 text-sm text-muted">
            <input
              type="checkbox"
              checked={all}
              disabled={pending}
              onChange={(e) => navigate({ all: e.target.checked })}
              className="h-4 w-4 accent-[var(--accent)]"
            />
            всё время
          </label>
        </div>
      </Labelled>
    </div>
  );
}

function Labelled({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-medium uppercase tracking-wide text-faint">
        {label}
      </span>
      {children}
    </label>
  );
}

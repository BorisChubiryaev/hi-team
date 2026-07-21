"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveReport } from "@/app/report/actions";
import type { ProjectInput } from "@/lib/reports";

const EMPTY: ProjectInput = { name: "", done: "", blockers: "", plans: "" };

export default function ReportForm({
  weekStartIso,
  initialProjects,
  projectNames = [],
  draftFromLabel = null,
  initialVacation = { enabled: false, weeks: null },
}: {
  weekStartIso: string;
  initialProjects: ProjectInput[];
  projectNames?: string[];
  draftFromLabel?: string | null;
  initialVacation?: { enabled: boolean; weeks: number | null };
}) {
  const [projects, setProjects] = useState<ProjectInput[]>(
    initialProjects.length ? initialProjects : [{ ...EMPTY }],
  );
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [vacationEnabled, setVacationEnabled] = useState(
    initialVacation.enabled,
  );
  const [vacationWeeks, setVacationWeeks] = useState<string>(
    initialVacation.weeks ? String(initialVacation.weeks) : "open",
  );
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function update(i: number, field: keyof ProjectInput, value: string) {
    setProjects((prev) =>
      prev.map((p, idx) => (idx === i ? { ...p, [field]: value } : p)),
    );
    setSaved(false);
  }

  function addProject() {
    setProjects((prev) => [...prev, { ...EMPTY }]);
  }

  function removeProject(i: number) {
    setProjects((prev) => prev.filter((_, idx) => idx !== i));
  }

  function onSave() {
    setError("");
    startTransition(async () => {
      const vacation = {
        enabled: vacationEnabled,
        weeks: vacationWeeks === "open" ? null : Number(vacationWeeks),
      };
      const res = await saveReport(weekStartIso, projects, vacation);
      if (res.ok) {
        setSaved(true);
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div className="space-y-6">
      {draftFromLabel && !saved && (
        <p className="rounded-lg border border-warn/25 bg-warn-bg px-4 py-3 text-sm text-warn">
          Черновик предзаполнен по планам за неделю {draftFromLabel}: планы
          перенесены в «Сделано» как заготовка, блокеры — как есть.
          Отредактируйте и нажмите «Сохранить отчёт».
        </p>
      )}
      {projectNames.length > 0 && (
        <datalist id="project-names">
          {projectNames.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
      )}
      {projects.map((p, i) => (
        <div key={i} className="card p-5">
          <div className="flex items-center justify-between gap-3">
            <input
              value={p.name}
              onChange={(e) => update(i, "name", e.target.value)}
              list="project-names"
              placeholder="Название проекта / направления"
              className="input font-medium"
            />
            {projects.length > 1 && (
              <button
                type="button"
                onClick={() => removeProject(i)}
                className="shrink-0 rounded-full px-2 py-1 text-sm text-danger transition hover:bg-danger-bg"
                aria-label="Удалить проект"
              >
                Удалить
              </button>
            )}
          </div>

          <div className="mt-4 space-y-4">
            <Field
              label="Сделано"
              value={p.done}
              onChange={(v) => update(i, "done", v)}
            />
            <Field
              label="Блокеры"
              value={p.blockers}
              onChange={(v) => update(i, "blockers", v)}
            />
            <Field
              label="Планы"
              value={p.plans}
              onChange={(v) => update(i, "plans", v)}
            />
          </div>
        </div>
      ))}

      <div className="card p-5">
        <label className="flex items-center gap-2 text-sm font-medium text-ink">
          <input
            type="checkbox"
            checked={vacationEnabled}
            onChange={(e) => {
              setVacationEnabled(e.target.checked);
              setSaved(false);
            }}
            className="h-4 w-4 accent-[var(--accent)]"
          />
          Со следующей недели я в отпуске
        </label>
        {vacationEnabled && (
          <label className="mt-3 flex items-center gap-2 text-sm text-muted">
            Срок:
            <select
              value={vacationWeeks}
              onChange={(e) => {
                setVacationWeeks(e.target.value);
                setSaved(false);
              }}
              className="input w-auto"
            >
              <option value="1">1 неделя</option>
              <option value="2">2 недели</option>
              <option value="3">3 недели</option>
              <option value="4">4 недели</option>
              <option value="open">пока не вернусь</option>
            </select>
          </label>
        )}
        <p className="mt-2 text-xs text-faint">
          В отпуске отчёт не требуется: вы не попадаете в «не сдали» и не
          получаете напоминания. Первый же сданный отчёт завершает отпуск.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={addProject} className="btn btn-ghost">
          + Добавить проект
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={pending}
          className="btn btn-primary"
        >
          {pending ? "Сохранение…" : "Сохранить отчёт"}
        </button>
        {saved && !pending && (
          <span className="text-sm text-success">Сохранено ✓</span>
        )}
      </div>

      {error && (
        <p className="rounded-lg border border-danger/25 bg-danger-bg px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-medium uppercase tracking-wide text-muted">
        {label}
      </span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
        className="input mt-1 min-h-28 resize-y"
      />
    </label>
  );
}

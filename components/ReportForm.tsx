"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Subteam } from "@prisma/client";
import { saveReport } from "@/app/report/actions";
import type { ProjectInput } from "@/lib/reports";
import { SUBTEAMS, SUBTEAM_LABELS, subteamTag } from "@/lib/subteam";

const EMPTY: ProjectInput = { name: "", done: "", blockers: "", plans: "" };

export default function ReportForm({
  weekStartIso,
  initialProjects,
  projectNames = [],
  draftFromLabel = null,
  initialSubteam = null,
  showSubteam = false,
  save = saveReport,
}: {
  weekStartIso: string;
  initialProjects: ProjectInput[];
  projectNames?: string[];
  draftFromLabel?: string | null;
  // Текущая подкоманда автора и нужно ли показывать её выбор (только командный
  // отчёт; раздел руководителя выбор подкоманды не показывает).
  initialSubteam?: Subteam | null;
  showSubteam?: boolean;
  // Функция сохранения (server action). По умолчанию — командный отчёт;
  // раздел руководителя передаёт свою (приватный отчёт).
  save?: (
    weekStartIso: string,
    projects: ProjectInput[],
    subteam?: Subteam | null,
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
}) {
  const [projects, setProjects] = useState<ProjectInput[]>(
    initialProjects.length ? initialProjects : [{ ...EMPTY }],
  );
  const [subteam, setSubteam] = useState<Subteam | null>(initialSubteam);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
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
      const res = await save(weekStartIso, projects, subteam);
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
      {showSubteam && (
        <div className="card p-5">
          <span className="block text-xs font-medium uppercase tracking-wide text-muted">
            Подкоманда
          </span>
          <p className="mt-1 text-sm text-muted">
            Выберите направление — по нему отчёт попадёт в нужный раздел
            AI-сводки недели.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {SUBTEAMS.map((s) => {
              const active = subteam === s;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    setSubteam(s);
                    setSaved(false);
                  }}
                  aria-pressed={active}
                  title={SUBTEAM_LABELS[s]}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                    active
                      ? "bg-ink text-card"
                      : "border border-line bg-card text-muted hover:bg-panel hover:text-ink"
                  }`}
                >
                  {subteamTag(s)}
                </button>
              );
            })}
          </div>
        </div>
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

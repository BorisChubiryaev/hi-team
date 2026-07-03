"use client";

import { useTransition } from "react";
import type { ProjectStatus } from "@prisma/client";
import { setProjectStatus } from "@/app/projects/actions";

const OPTIONS: { value: ProjectStatus; label: string }[] = [
  { value: "ACTIVE", label: "Активен" },
  { value: "PAUSED", label: "На паузе" },
  { value: "DONE", label: "Завершён" },
];

export default function ProjectStatusSelect({
  projectId,
  status,
}: {
  projectId: string;
  status: ProjectStatus;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <select
      value={status}
      disabled={pending}
      onChange={(e) =>
        startTransition(() =>
          setProjectStatus(projectId, e.target.value as ProjectStatus),
        )
      }
      className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-700 outline-none focus:border-blue-500 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
      aria-label="Статус проекта"
    >
      {OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

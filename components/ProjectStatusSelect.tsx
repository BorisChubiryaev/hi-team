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
      className="rounded-lg border border-line bg-card px-2 py-1.5 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:opacity-60"
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

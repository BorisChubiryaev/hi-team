"use client";

// Выбор периода для подготовки к встрече: кварталы (слева направо,
// текущий справа) + произвольный диапазон дат, который применяется сразу
// при изменении. При выборе квартала поля дат сами показывают его границы.

import { useRouter } from "next/navigation";

export default function ReviewPeriodPicker({
  quarters,
  selectedKey,
  startIso,
  endIso,
}: {
  quarters: { key: string; label: string }[];
  selectedKey: string;
  startIso: string;
  endIso: string;
}) {
  const router = useRouter();
  const go = (href: string) => router.push(href);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {quarters.map((q) => {
          const active = q.key === selectedKey;
          return (
            <button
              key={q.key}
              type="button"
              onClick={() => go(`/review?period=${q.key}`)}
              className={`rounded-full px-3 py-1.5 text-sm transition ${
                active
                  ? "bg-ink font-medium text-card"
                  : "border border-line bg-card text-muted hover:bg-panel hover:text-ink"
              }`}
            >
              {q.label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
        <span>или свой период:</span>
        <input
          key={`start-${startIso}`}
          type="date"
          defaultValue={startIso}
          max={endIso}
          onChange={(e) =>
            e.target.value && go(`/review?start=${e.target.value}&end=${endIso}`)
          }
          className="input w-auto py-1.5"
          aria-label="Начало периода"
        />
        <span>—</span>
        <input
          key={`end-${endIso}`}
          type="date"
          defaultValue={endIso}
          min={startIso}
          onChange={(e) =>
            e.target.value && go(`/review?start=${startIso}&end=${e.target.value}`)
          }
          className="input w-auto py-1.5"
          aria-label="Конец периода"
        />
      </div>
    </div>
  );
}

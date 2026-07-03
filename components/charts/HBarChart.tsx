"use client";

// Горизонтальные бары одной серии: один цвет для всех категорий (identity,
// не magnitude), значение у конца бара, ссылка на страницу проекта.

import Link from "next/link";
import { useState } from "react";

export type HBarDatum = { id: string; name: string; value: number };

export default function HBarChart({
  data,
  unit,
}: {
  data: HBarDatum[];
  unit: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="space-y-2">
      {data.map((d, i) => (
        <div
          key={d.id}
          className="flex items-center gap-3 outline-none"
          tabIndex={0}
          onMouseEnter={() => setHover(i)}
          onMouseLeave={() => setHover(null)}
          onFocus={() => setHover(i)}
          onBlur={() => setHover(null)}
          aria-label={`${d.name}: ${d.value} ${unit}`}
        >
          <Link
            href={`/projects/${d.id}`}
            title={d.name}
            className="w-44 shrink-0 truncate text-xs hover:underline"
            style={{ color: "var(--viz-text-secondary)" }}
          >
            {d.name}
          </Link>
          <div className="flex flex-1 items-center gap-2">
            <div
              className="h-[16px] rounded-r-[4px] transition-opacity"
              style={{
                width: `${(d.value / max) * 100}%`,
                minWidth: "3px",
                background: "var(--viz-series)",
                opacity: hover === null || hover === i ? 1 : 0.45,
              }}
            />
            <span
              className="text-xs font-medium tabular-nums"
              style={{ color: "var(--viz-text-secondary)" }}
            >
              {d.value}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

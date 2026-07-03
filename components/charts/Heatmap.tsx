"use client";

// Тепловая карта «проект × неделя»: секвенциальная одноцветная рампа
// (валидирована validate_palette.js в обоих режимах), 2px-зазоры поверхности
// между ячейками, тултип и легенда шкалы, таблица данных.

import { useState } from "react";

export type HeatmapData = {
  weekLabels: string[];
  weekShorts: string[];
  rows: { id: string; name: string; cells: number[] }[];
};

const RAMP_VARS = ["--heat-1", "--heat-2", "--heat-3", "--heat-4"];

function cellColor(value: number, max: number): string {
  if (value <= 0) return "var(--viz-track)";
  const bucket = Math.min(
    RAMP_VARS.length - 1,
    Math.floor(((value - 1) / Math.max(max - 1, 1)) * (RAMP_VARS.length - 1) + 0.5),
  );
  return `var(${RAMP_VARS[bucket]})`;
}

export default function Heatmap({
  data,
  unit,
  tableCaption,
}: {
  data: HeatmapData;
  unit: string;
  tableCaption: string;
}) {
  const [hover, setHover] = useState<{ r: number; c: number } | null>(null);
  const max = Math.max(...data.rows.flatMap((r) => r.cells), 1);

  return (
    <div>
      <div className="overflow-x-auto">
        <div className="min-w-fit">
          {/* заголовки недель */}
          <div className="flex gap-[2px] pl-44">
            {data.weekShorts.map((s, c) => (
              <div
                key={c}
                title={data.weekLabels[c]}
                className="w-8 truncate text-center text-[9px]"
                style={{ color: "var(--viz-text-muted)" }}
              >
                {s}
              </div>
            ))}
          </div>

          {data.rows.map((row, r) => (
            <div key={row.id} className="mt-[2px] flex items-center gap-[2px]">
              <div
                title={row.name}
                className="w-44 shrink-0 truncate pr-2 text-xs"
                style={{ color: "var(--viz-text-secondary)" }}
              >
                {row.name}
              </div>
              {row.cells.map((v, c) => (
                <div
                  key={c}
                  tabIndex={0}
                  onMouseEnter={() => setHover({ r, c })}
                  onMouseLeave={() => setHover(null)}
                  onFocus={() => setHover({ r, c })}
                  onBlur={() => setHover(null)}
                  aria-label={`${row.name}, ${data.weekLabels[c]}: ${v} ${unit}`}
                  className="relative h-6 w-8 cursor-default rounded-[3px] outline-none"
                  style={{
                    background: cellColor(v, max),
                    boxShadow:
                      hover?.r === r && hover?.c === c
                        ? "inset 0 0 0 1.5px var(--viz-text-secondary)"
                        : undefined,
                  }}
                >
                  {hover?.r === r && hover?.c === c && (
                    <div
                      className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 whitespace-nowrap rounded-md border px-2.5 py-1.5 text-xs shadow-sm"
                      style={{
                        background: "var(--viz-surface)",
                        borderColor: "var(--viz-grid)",
                      }}
                    >
                      <span
                        className="font-semibold tabular-nums"
                        style={{ color: "var(--viz-text-primary)" }}
                      >
                        {v} {unit}
                      </span>{" "}
                      <span style={{ color: "var(--viz-text-secondary)" }}>
                        · {row.name}, {data.weekLabels[c]}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}

          {/* легенда шкалы */}
          <div className="mt-3 flex items-center gap-1.5 pl-44 text-[10px]">
            <span style={{ color: "var(--viz-text-muted)" }}>0</span>
            <div
              className="h-3 w-5 rounded-[3px]"
              style={{ background: "var(--viz-track)" }}
            />
            {RAMP_VARS.map((v) => (
              <div
                key={v}
                className="h-3 w-5 rounded-[3px]"
                style={{ background: `var(${v})` }}
              />
            ))}
            <span style={{ color: "var(--viz-text-muted)" }}>
              больше {unit}
            </span>
          </div>
        </div>
      </div>

      <details className="mt-3">
        <summary
          className="cursor-pointer text-xs"
          style={{ color: "var(--viz-text-muted)" }}
        >
          Данные таблицей
        </summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-xs">
            <caption className="sr-only">{tableCaption}</caption>
            <thead>
              <tr>
                <th
                  className="py-0.5 pr-4 text-left font-medium"
                  style={{ color: "var(--viz-text-secondary)" }}
                >
                  Проект
                </th>
                {data.weekLabels.map((l) => (
                  <th
                    key={l}
                    className="px-1 py-0.5 text-right font-medium"
                    style={{ color: "var(--viz-text-secondary)" }}
                  >
                    {l}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr key={row.id}>
                  <td
                    className="py-0.5 pr-4"
                    style={{ color: "var(--viz-text-secondary)" }}
                  >
                    {row.name}
                  </td>
                  {row.cells.map((v, c) => (
                    <td
                      key={c}
                      className="px-1 py-0.5 text-right tabular-nums"
                      style={{ color: "var(--viz-text-primary)" }}
                    >
                      {v}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

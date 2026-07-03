"use client";

// Колончатый график одной серии: тонкие колонки (≤24px), скруглённый верх,
// волосяная сетка, выборочные подписи (последняя и максимум), тултип по
// наведению/фокусу и табличное представление данных.

import { useState } from "react";

export type ColumnDatum = { label: string; short: string; value: number };

function ticks(max: number): number[] {
  if (max <= 4) return Array.from({ length: max + 1 }, (_, i) => i);
  const step = Math.ceil(max / 4);
  const out: number[] = [];
  for (let v = 0; v <= max; v += step) out.push(v);
  if (out.at(-1) !== max) out.push(max);
  return out;
}

export default function ColumnChart({
  data,
  maxValue,
  unit,
  tableCaption,
}: {
  data: ColumnDatum[];
  /** Верх шкалы (например, размер команды); по умолчанию — максимум данных. */
  maxValue?: number;
  unit: string;
  tableCaption: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(maxValue ?? 0, ...data.map((d) => d.value), 1);
  const maxIdx = data.reduce(
    (best, d, i) => (d.value > data[best].value ? i : best),
    0,
  );
  const plotH = 160;
  const headroom = 18; // место под подпись значения над самой высокой колонкой
  const yTicks = ticks(max);

  return (
    <div>
      {/* область графика: сетка + колонки; подписи X — отдельной строкой ниже */}
      <div className="relative ml-7" style={{ height: `${plotH + headroom}px` }}>
        {yTicks.map((t) => (
          <div
            key={t}
            aria-hidden
            className="absolute inset-x-0 border-t"
            style={{
              bottom: `${(t / max) * plotH}px`,
              borderColor: "var(--viz-grid)",
            }}
          >
            <span
              className="absolute -left-7 -top-2 w-6 text-right text-[10px] tabular-nums"
              style={{ color: "var(--viz-text-muted)" }}
            >
              {t}
            </span>
          </div>
        ))}

        <div
          className="absolute inset-x-0 bottom-0 flex items-end gap-[2px]"
          style={{ height: `${plotH}px` }}
        >
          {data.map((d, i) => {
            const h = Math.round((d.value / max) * plotH);
            const labeled = i === data.length - 1 || i === maxIdx;
            return (
              <div
                key={d.label}
                className="relative flex h-full flex-1 cursor-default items-end justify-center outline-none"
                tabIndex={0}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                aria-label={`${d.label}: ${d.value} ${unit}`}
              >
                {labeled && d.value > 0 && (
                  <span
                    className="absolute text-[10px] font-medium tabular-nums"
                    style={{
                      bottom: `${h + 4}px`,
                      color: "var(--viz-text-secondary)",
                    }}
                  >
                    {d.value}
                  </span>
                )}
                <div
                  className="w-full max-w-[24px] rounded-t-[4px] transition-opacity"
                  style={{
                    height: `${Math.max(h, d.value > 0 ? 3 : 0)}px`,
                    background: "var(--viz-series)",
                    opacity: hover === null || hover === i ? 1 : 0.45,
                  }}
                />

                {hover === i && (
                  <div
                    className="pointer-events-none absolute bottom-full z-10 mb-1 whitespace-nowrap rounded-md border px-2.5 py-1.5 text-xs shadow-sm"
                    style={{
                      background: "var(--viz-surface)",
                      borderColor: "var(--viz-grid)",
                    }}
                  >
                    <span
                      className="font-semibold tabular-nums"
                      style={{ color: "var(--viz-text-primary)" }}
                    >
                      {d.value} {unit}
                    </span>{" "}
                    <span style={{ color: "var(--viz-text-secondary)" }}>
                      · {d.label}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* подписи X — те же flex-слоты, что и колонки, поэтому не смещаются */}
      <div className="ml-7 mt-1 flex gap-[2px]">
        {data.map((d) => (
          <span
            key={d.label}
            className="flex-1 truncate text-center text-[10px]"
            style={{ color: "var(--viz-text-muted)" }}
          >
            {d.short}
          </span>
        ))}
      </div>

      <details className="mt-2">
        <summary
          className="cursor-pointer text-xs"
          style={{ color: "var(--viz-text-muted)" }}
        >
          Данные таблицей
        </summary>
        <table className="mt-2 w-full text-xs">
          <caption className="sr-only">{tableCaption}</caption>
          <tbody>
            {data.map((d) => (
              <tr key={d.label}>
                <td
                  className="py-0.5 pr-4"
                  style={{ color: "var(--viz-text-secondary)" }}
                >
                  {d.label}
                </td>
                <td
                  className="py-0.5 text-right tabular-nums"
                  style={{ color: "var(--viz-text-primary)" }}
                >
                  {d.value}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}

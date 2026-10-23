"use client";

// Тепловая карта «проект × неделя»: секвенциальная одноцветная рампа
// (валидирована validate_palette.js в обоих режимах), 2px-зазоры поверхности
// между ячейками, тултип и легенда шкалы, таблица данных.

import { useLayoutEffect, useRef, useState } from "react";

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

type Hover = { r: number; c: number; rect: DOMRect };

export default function Heatmap({
  data,
  unit,
  tableCaption,
}: {
  data: HeatmapData;
  unit: string;
  tableCaption: string;
}) {
  const [hover, setHover] = useState<Hover | null>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const [tipPos, setTipPos] = useState<{ left: number; top: number } | null>(
    null,
  );
  const max = Math.max(...data.rows.flatMap((r) => r.cells), 1);

  // Тултип вынесен в position: fixed — внутри overflow-x-auto он обрезался
  // у верхних рядов. Ставим над ячейкой (или под ней, если сверху нет места)
  // и прижимаем к краям окна.
  useLayoutEffect(() => {
    const tip = tipRef.current;
    if (!hover || !tip) return setTipPos(null);
    const { width, height } = tip.getBoundingClientRect();
    const gap = 4;
    const cx = hover.rect.left + hover.rect.width / 2;
    const left = Math.min(
      Math.max(cx - width / 2, 8),
      window.innerWidth - width - 8,
    );
    const above = hover.rect.top - height - gap;
    const top = above >= 8 ? above : hover.rect.bottom + gap;
    setTipPos({ left, top });
  }, [hover]);

  // При прокрутке страницы координаты устаревают — прячем тултип.
  useLayoutEffect(() => {
    if (!hover) return;
    const hide = () => setHover(null);
    window.addEventListener("scroll", hide, true);
    return () => window.removeEventListener("scroll", hide, true);
  }, [hover]);

  const show = (r: number, c: number, el: HTMLElement) =>
    setHover({ r, c, rect: el.getBoundingClientRect() });

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
                  onMouseEnter={(e) => show(r, c, e.currentTarget)}
                  onMouseLeave={() => setHover(null)}
                  onFocus={(e) => show(r, c, e.currentTarget)}
                  onBlur={() => setHover(null)}
                  aria-label={`${row.name}, ${data.weekLabels[c]}: ${v} ${unit}`}
                  className="h-6 w-8 cursor-default rounded-[3px] outline-none"
                  style={{
                    background: cellColor(v, max),
                    boxShadow:
                      hover?.r === r && hover?.c === c
                        ? "inset 0 0 0 1.5px var(--viz-text-secondary)"
                        : undefined,
                  }}
                />
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

      {hover && (
        <div
          ref={tipRef}
          role="tooltip"
          className="pointer-events-none fixed z-50 whitespace-nowrap rounded-md border px-2.5 py-1.5 text-xs shadow-sm"
          style={{
            left: tipPos?.left ?? 0,
            top: tipPos?.top ?? 0,
            visibility: tipPos ? "visible" : "hidden",
            background: "var(--viz-surface)",
            borderColor: "var(--viz-grid)",
          }}
        >
          <span
            className="font-semibold tabular-nums"
            style={{ color: "var(--viz-text-primary)" }}
          >
            {data.rows[hover.r].cells[hover.c]} {unit}
          </span>{" "}
          <span style={{ color: "var(--viz-text-secondary)" }}>
            · {data.rows[hover.r].name}, {data.weekLabels[hover.c]}
          </span>
        </div>
      )}

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

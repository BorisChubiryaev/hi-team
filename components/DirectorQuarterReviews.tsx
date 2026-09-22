// Раздел аналитики для роли «Руководитель»: квартальные резюме сотрудников к
// встрече 1:1. Показывает, у кого резюме готово, а у кого нет; каждое — в
// свёрнутом виде (native <details>), с фильтром по кварталам.

import Markdown from "@/components/Markdown";
import { subteamTag } from "@/lib/subteam";

export type EmployeeReview = {
  id: string;
  name: string;
  subteamKey: string | null;
  hasPrep: boolean;
  content: string;
  focus: string | null;
  updatedAt: string; // уже отформатированная дата, "" если нет резюме
};

export default function DirectorQuarterReviews({
  quarters,
  periodLabel,
  employees,
}: {
  quarters: { key: string; label: string; href: string; active: boolean }[];
  periodLabel: string;
  employees: EmployeeReview[];
}) {
  const ready = employees.filter((e) => e.hasPrep).length;
  const total = employees.length;

  return (
    <section className="card mt-6 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-medium text-ink">Резюме сотрудников к встрече 1:1</h2>
        <span className="text-xs text-muted">
          {periodLabel}: готово{" "}
          <span className="font-semibold text-ink">
            {ready} из {total}
          </span>
        </span>
      </div>
      <p className="mb-3 mt-0.5 text-xs text-muted">
        Что сотрудник собрал по своей работе за квартал (раздел «К встрече»).
        Разверните, чтобы прочитать.
      </p>

      {/* Фильтр по кварталам */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        {quarters.map((q) => (
          <a
            key={q.key}
            href={q.href}
            aria-current={q.active ? "true" : undefined}
            className={`rounded-full px-3 py-1 text-sm transition ${
              q.active
                ? "bg-ink text-card"
                : "border border-line bg-card text-muted hover:bg-panel hover:text-ink"
            }`}
          >
            {q.label}
          </a>
        ))}
      </div>

      {total === 0 ? (
        <p className="py-4 text-center text-sm text-faint">
          В команде пока нет сотрудников, пишущих отчёты.
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {employees.map((e) =>
            e.hasPrep ? (
              <li key={e.id}>
                <details className="group">
                  <summary className="flex cursor-pointer list-none items-center gap-2 py-2.5">
                    <span className="text-faint transition group-open:rotate-90">
                      ▸
                    </span>
                    <span className="font-medium text-ink">{e.name}</span>
                    {e.subteamKey && (
                      <span className="rounded-full bg-cream px-2 py-0.5 font-mono text-[11px] font-medium text-cream-ink">
                        {subteamTag(e.subteamKey)}
                      </span>
                    )}
                    <span className="ml-auto flex items-center gap-2">
                      {e.updatedAt && (
                        <span className="text-xs text-faint">{e.updatedAt}</span>
                      )}
                      <span className="rounded-full bg-success-bg px-2 py-0.5 text-xs font-medium text-success">
                        Готово ✓
                      </span>
                    </span>
                  </summary>
                  <div className="pb-4 pl-6">
                    {e.focus && (
                      <p className="mb-3 rounded-lg border border-line bg-panel px-3 py-2 text-xs text-muted">
                        <span className="font-medium text-ink">Акцент: </span>
                        {e.focus}
                      </p>
                    )}
                    <Markdown>{e.content}</Markdown>
                  </div>
                </details>
              </li>
            ) : (
              <li
                key={e.id}
                className="flex items-center gap-2 py-2.5 pl-6 text-muted"
              >
                <span className="font-medium">{e.name}</span>
                {e.subteamKey && (
                  <span className="rounded-full bg-cream px-2 py-0.5 font-mono text-[11px] font-medium text-cream-ink">
                    {subteamTag(e.subteamKey)}
                  </span>
                )}
                <span className="ml-auto rounded-full border border-line px-2 py-0.5 text-xs text-faint">
                  Нет резюме
                </span>
              </li>
            ),
          )}
        </ul>
      )}
    </section>
  );
}

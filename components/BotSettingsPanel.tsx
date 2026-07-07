"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DOW_LABELS, TIMEZONES } from "@/lib/bot-constants";
import {
  sendGroupRosterNow,
  sendReminderNow,
  updateBotSettings,
} from "@/app/admin/actions";

const HOURS = Array.from({ length: 24 }, (_, h) => h);
const DAYS = [1, 2, 3, 4, 5, 6, 7];

export default function BotSettingsPanel({
  reminderEnabled: initReminderEnabled,
  reminderDow: initReminderDow,
  reminderHour: initReminderHour,
  groupEnabled: initGroupEnabled,
  groupDow: initGroupDow,
  groupHour: initGroupHour,
  timezone: initTimezone,
  groupChatId,
  groupTitle,
}: {
  reminderEnabled: boolean;
  reminderDow: number;
  reminderHour: number;
  groupEnabled: boolean;
  groupDow: number;
  groupHour: number;
  timezone: string;
  groupChatId: string | null;
  groupTitle: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [note, setNote] = useState("");

  const [reminderEnabled, setReminderEnabled] = useState(initReminderEnabled);
  const [reminderDow, setReminderDow] = useState(initReminderDow);
  const [reminderHour, setReminderHour] = useState(initReminderHour);
  const [groupEnabled, setGroupEnabled] = useState(initGroupEnabled);
  const [groupDow, setGroupDow] = useState(initGroupDow);
  const [groupHour, setGroupHour] = useState(initGroupHour);
  const [timezone, setTimezone] = useState(initTimezone);

  function save() {
    setSaved(false);
    setNote("");
    startTransition(async () => {
      await updateBotSettings({
        reminderEnabled,
        reminderDow,
        reminderHour,
        groupEnabled,
        groupDow,
        groupHour,
        timezone,
      });
      setSaved(true);
      router.refresh();
    });
  }

  function testReminder() {
    setNote("");
    startTransition(async () => {
      const r = await sendReminderNow();
      setNote(r.message);
    });
  }

  function testGroup() {
    setNote("");
    startTransition(async () => {
      const r = await sendGroupRosterNow();
      setNote(r.message);
    });
  }

  const selectClass =
    "rounded-lg border border-line bg-card px-2.5 py-1.5 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:opacity-50";

  return (
    <div className="card mt-6 p-5">
      <h2 className="font-semibold text-ink">Бот: напоминания и сводки</h2>
      <p className="mt-0.5 text-sm text-muted">
        Расписание в выбранной таймзоне. Проверяется раз в час.
      </p>

      {/* Таймзона */}
      <label className="mt-4 flex flex-col gap-1">
        <span className="text-[11px] font-medium uppercase tracking-wide text-faint">
          Таймзона команды
        </span>
        <select
          className={`${selectClass} max-w-xs`}
          value={timezone}
          disabled={pending}
          onChange={(e) => setTimezone(e.target.value)}
        >
          {TIMEZONES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </label>

      {/* Личные напоминания */}
      <section className="mt-5 border-t border-line pt-4">
        <label className="flex items-center gap-2 text-sm font-medium text-ink">
          <input
            type="checkbox"
            checked={reminderEnabled}
            disabled={pending}
            onChange={(e) => setReminderEnabled(e.target.checked)}
            className="h-4 w-4 accent-[var(--accent)]"
          />
          Личные напоминания не сдавшим
        </label>
        <p className="mt-1 text-xs text-muted">
          Бот пишет в личку тем, кто не сдал отчёт. Если сдали все — сообщает
          руководителям. Работает только у тех, кто привязал Telegram.
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <DayHour
            day={reminderDow}
            hour={reminderHour}
            disabled={pending || !reminderEnabled}
            onDay={setReminderDow}
            onHour={setReminderHour}
            selectClass={selectClass}
          />
          <button
            type="button"
            onClick={testReminder}
            disabled={pending}
            className="btn btn-ghost btn-sm"
          >
            Отправить сейчас
          </button>
        </div>
      </section>

      {/* Групповой ростер */}
      <section className="mt-5 border-t border-line pt-4">
        <label className="flex items-center gap-2 text-sm font-medium text-ink">
          <input
            type="checkbox"
            checked={groupEnabled}
            disabled={pending || !groupChatId}
            onChange={(e) => setGroupEnabled(e.target.checked)}
            className="h-4 w-4 accent-[var(--accent)]"
          />
          Сводка «кто сдал / кто нет» в общий чат
        </label>

        {groupChatId ? (
          <p className="mt-1 text-xs text-muted">
            Подключён чат:{" "}
            <span className="font-medium text-ink">
              {groupTitle || groupChatId}
            </span>
            . Бот публикует ростер по расписанию.
          </p>
        ) : (
          <p className="mt-1 rounded-lg border border-warn/25 bg-warn-bg px-3 py-2 text-xs text-warn">
            Чат не подключён. Добавьте бота в нужный групповой чат и отправьте
            там команду <code className="font-mono">/here</code> (от лица
            руководителя) — чат появится здесь.
          </p>
        )}

        <div className="mt-3 flex flex-wrap items-end gap-3">
          <DayHour
            day={groupDow}
            hour={groupHour}
            disabled={pending || !groupEnabled || !groupChatId}
            onDay={setGroupDow}
            onHour={setGroupHour}
            selectClass={selectClass}
          />
          <button
            type="button"
            onClick={testGroup}
            disabled={pending || !groupChatId}
            className="btn btn-ghost btn-sm"
          >
            Отправить сейчас
          </button>
        </div>
      </section>

      <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-line pt-4">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="btn btn-primary"
        >
          {pending ? "Сохранение…" : "Сохранить настройки"}
        </button>
        {saved && !pending && (
          <span className="text-sm text-success">Сохранено ✓</span>
        )}
        {note && <span className="text-sm text-muted">{note}</span>}
      </div>
    </div>
  );
}

function DayHour({
  day,
  hour,
  disabled,
  onDay,
  onHour,
  selectClass,
}: {
  day: number;
  hour: number;
  disabled: boolean;
  onDay: (n: number) => void;
  onHour: (n: number) => void;
  selectClass: string;
}) {
  return (
    <div className="flex items-end gap-2">
      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-medium uppercase tracking-wide text-faint">
          День
        </span>
        <select
          className={selectClass}
          value={day}
          disabled={disabled}
          onChange={(e) => onDay(Number(e.target.value))}
        >
          {DAYS.map((d) => (
            <option key={d} value={d}>
              {DOW_LABELS[d]}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-medium uppercase tracking-wide text-faint">
          Время
        </span>
        <select
          className={selectClass}
          value={hour}
          disabled={disabled}
          onChange={(e) => onHour(Number(e.target.value))}
        >
          {HOURS.map((h) => (
            <option key={h} value={h}>
              {String(h).padStart(2, "0")}:00
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

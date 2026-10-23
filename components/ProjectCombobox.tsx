"use client";

import { useId, useRef, useState } from "react";

// Поле названия проекта с выпадающим списком известных проектов.
// Нативный <datalist> не годится: он фильтрует по уже введённому значению
// (у предзаполненного поля список пуст), не имеет стрелки и по-разному
// работает в браузерах.
export default function ProjectCombobox({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  // Фильтруем только пока пользователь печатает; при открытии — весь список.
  const [filtering, setFiltering] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const q = value.trim().toLowerCase();
  const items =
    filtering && q
      ? options.filter((o) => o.toLowerCase().includes(q))
      : options;
  const showList = open && items.length > 0;

  function openList() {
    setFiltering(false);
    setActive(-1);
    setOpen(true);
  }

  function pick(name: string) {
    onChange(name);
    setOpen(false);
    setActive(-1);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) return openList();
      if (!items.length) return;
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive((a) => (a + step + items.length) % items.length);
    } else if (e.key === "Enter" && showList && active >= 0) {
      e.preventDefault();
      pick(items[active]);
    } else if (e.key === "Escape" && open) {
      e.preventDefault();
      setOpen(false);
    }
  }

  return (
    <div className="relative w-full">
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setFiltering(true);
          setActive(-1);
          setOpen(true);
        }}
        onFocus={openList}
        onClick={() => !open && openList()}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        className="input pr-9 font-medium"
      />
      {options.length > 0 && (
        <button
          type="button"
          tabIndex={-1}
          aria-label="Показать проекты"
          // mousedown, чтобы не терять фокус поля (иначе onBlur закроет список).
          onMouseDown={(e) => {
            e.preventDefault();
            if (open) {
              setOpen(false);
            } else {
              inputRef.current?.focus();
              openList();
            }
          }}
          className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-faint transition hover:text-ink"
        >
          <svg
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
            className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`}
          >
            <path
              fillRule="evenodd"
              d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.17l3.71-3.94a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      )}
      {showList && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-line bg-card py-1 shadow-[var(--shadow-lift)]"
        >
          {items.map((name, idx) => (
            <li
              key={name}
              role="option"
              aria-selected={name === value}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(name);
              }}
              onMouseEnter={() => setActive(idx)}
              className={`cursor-pointer px-3 py-2 text-sm ${
                idx === active ? "bg-panel text-ink" : "text-ink"
              } ${name === value ? "font-medium" : ""}`}
            >
              {name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

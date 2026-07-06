import Link from "next/link";
import { signOut } from "@/lib/auth";

export default function Header({
  email,
  active,
  isLead = false,
}: {
  email?: string | null;
  active:
    | "dashboard"
    | "report"
    | "projects"
    | "monthly"
    | "analytics"
    | "admin"
    | "settings";
  isLead?: boolean;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-canvas/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-6 px-4 sm:px-6">
        <Link href="/dashboard" className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-lg bg-accent text-[15px] font-semibold text-white">
            h
          </span>
          <span className="font-semibold tracking-tight text-ink">hi-team</span>
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <Tab href="/dashboard" label="Отчёты" active={active === "dashboard"} />
          <Tab href="/report" label="Мой отчёт" active={active === "report"} />
          <Tab href="/projects" label="Проекты" active={active === "projects"} />
          <Tab href="/monthly" label="Месяц" active={active === "monthly"} />
          <Tab
            href="/analytics"
            label="Аналитика"
            active={active === "analytics"}
          />
          {isLead && (
            <Tab href="/admin" label="Команда" active={active === "admin"} />
          )}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          {email && (
            <Link
              href="/settings"
              title="Настройки"
              className={`hidden text-sm transition sm:inline ${
                active === "settings"
                  ? "font-medium text-ink"
                  : "text-muted hover:text-ink"
              }`}
            >
              {email}
            </Link>
          )}
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button
              type="submit"
              className="rounded-full px-3 py-1.5 text-sm text-muted transition hover:bg-panel hover:text-ink"
            >
              Выйти
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}

function Tab({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`rounded-full px-3 py-1.5 transition ${
        active
          ? "bg-panel font-medium text-ink"
          : "text-muted hover:bg-panel hover:text-ink"
      }`}
    >
      {label}
    </Link>
  );
}

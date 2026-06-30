import Link from "next/link";
import { signOut } from "@/lib/auth";

export default function Header({
  email,
  active,
}: {
  email?: string | null;
  active: "dashboard" | "report";
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-6 px-4 sm:px-6">
        <Link href="/dashboard" className="font-semibold text-slate-900 dark:text-white">
          hi-team
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <Tab href="/dashboard" label="Отчёты" active={active === "dashboard"} />
          <Tab href="/report" label="Мой отчёт" active={active === "report"} />
        </nav>
        <div className="ml-auto flex items-center gap-3">
          {email && (
            <span className="hidden text-sm text-slate-500 sm:inline dark:text-slate-400">
              {email}
            </span>
          )}
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button
              type="submit"
              className="rounded-lg px-3 py-1.5 text-sm text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
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
      className={`rounded-lg px-3 py-1.5 transition ${
        active
          ? "bg-blue-50 font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300"
          : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
      }`}
    >
      {label}
    </Link>
  );
}

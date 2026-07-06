import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import LoginForm from "@/components/LoginForm";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <main className="flex min-h-dvh items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-card p-8 shadow-[var(--shadow-soft)]">
        <div className="mb-6 flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-accent text-base font-semibold text-white">
            h
          </span>
          <div>
            <h1 className="text-lg font-semibold leading-tight tracking-tight text-ink">
              hi-team
            </h1>
            <p className="text-xs text-muted">Еженедельные отчёты команды</p>
          </div>
        </div>

        <LoginForm />

        <p className="mt-6 text-xs text-faint">
          Вход доступен только участникам команды.
        </p>
      </div>
    </main>
  );
}

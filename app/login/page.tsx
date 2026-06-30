import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import LoginForm from "@/components/LoginForm";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
          hi-team
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Еженедельные отчёты команды
        </p>

        <LoginForm />

        <p className="mt-6 text-xs text-slate-400 dark:text-slate-500">
          Вход доступен только участникам команды.
        </p>
      </div>
    </main>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { setPassword } from "@/app/login/actions";

export default function LoginForm() {
  const [mode, setMode] = useState<"login" | "first">("login");
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    start(async () => {
      if (mode === "first") {
        if (pwd !== confirm) {
          setError("Пароли не совпадают");
          return;
        }
        const res = await setPassword(email, pwd);
        if (!res.ok) {
          setError(res.error);
          return;
        }
      }
      const r = await signIn("credentials", {
        email,
        password: pwd,
        redirect: false,
      });
      if (r?.error) {
        setError(
          mode === "login" ? "Неверная почта или пароль" : "Не удалось войти",
        );
        return;
      }
      router.push("/dashboard");
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-4">
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          Рабочая почта
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="name@company.ru"
          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
        />
      </div>

      <div>
        <label htmlFor="pwd" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          {mode === "first" ? "Придумайте пароль" : "Пароль"}
        </label>
        <input
          id="pwd"
          type="password"
          required
          autoComplete={mode === "first" ? "new-password" : "current-password"}
          value={pwd}
          onChange={(e) => setPwd(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
        />
      </div>

      {mode === "first" && (
        <div>
          <label htmlFor="confirm" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Повторите пароль
          </label>
          <input
            id="confirm"
            type="password"
            required
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
          />
        </div>
      )}

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-60"
      >
        {pending
          ? "Подождите…"
          : mode === "login"
            ? "Войти"
            : "Задать пароль и войти"}
      </button>

      <button
        type="button"
        onClick={() => {
          setMode((m) => (m === "login" ? "first" : "login"));
          setError("");
          setConfirm("");
        }}
        className="w-full text-center text-sm text-blue-600 hover:underline dark:text-blue-400"
      >
        {mode === "login"
          ? "Первый вход? Задать пароль"
          : "← У меня уже есть пароль"}
      </button>
    </form>
  );
}

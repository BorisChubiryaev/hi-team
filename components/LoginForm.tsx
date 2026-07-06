"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { setPassword } from "@/app/login/actions";

export default function LoginForm() {
  const [mode, setMode] = useState<"login" | "first">("login");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
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
        const res = await setPassword(email, pwd, name);
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
      {mode === "first" && (
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-ink">
            Имя и фамилия
          </label>
          <input
            id="name"
            type="text"
            required
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Иван Иванов"
            className="input mt-1"
          />
        </div>
      )}

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-ink">
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
          className="input mt-1"
        />
      </div>

      <div>
        <label htmlFor="pwd" className="block text-sm font-medium text-ink">
          {mode === "first" ? "Придумайте пароль" : "Пароль"}
        </label>
        <input
          id="pwd"
          type="password"
          required
          autoComplete={mode === "first" ? "new-password" : "current-password"}
          value={pwd}
          onChange={(e) => setPwd(e.target.value)}
          className="input mt-1"
        />
      </div>

      {mode === "first" && (
        <div>
          <label htmlFor="confirm" className="block text-sm font-medium text-ink">
            Повторите пароль
          </label>
          <input
            id="confirm"
            type="password"
            required
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="input mt-1"
          />
        </div>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}

      <button type="submit" disabled={pending} className="btn btn-primary w-full">
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
          setName("");
        }}
        className="w-full text-center text-sm text-accent hover:underline"
      >
        {mode === "login"
          ? "Первый вход? Задать пароль"
          : "← У меня уже есть пароль"}
      </button>
    </form>
  );
}

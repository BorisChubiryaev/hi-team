"use client";

import { useState } from "react";
import { sendSummaryByEmail } from "@/app/summary/actions";

export default function EmailSummaryButton({
  subject,
  content,
  defaultEmail = "",
}: {
  subject: string;
  content: string;
  defaultEmail?: string;
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(defaultEmail);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function send() {
    setSending(true);
    setError("");
    setSent(false);
    try {
      const res = await sendSummaryByEmail({ to: email, subject, content });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSent(true);
      setOpen(false);
    } catch {
      setError("Не удалось отправить");
    } finally {
      setSending(false);
    }
  }

  if (!open) {
    return (
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setSent(false);
            setError("");
          }}
          className="btn btn-ghost btn-sm"
        >
          На почту
        </button>
        {sent && <span className="text-xs text-success">Отправлено ✓</span>}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && email.trim() && !sending) send();
        }}
        placeholder="куда отправить, email"
        aria-label="Почта получателя"
        autoFocus
        className="input max-w-[220px] py-1.5 text-xs"
      />
      <button
        type="button"
        onClick={send}
        disabled={sending || !email.trim()}
        className="btn btn-primary btn-sm"
      >
        {sending ? "Отправка…" : "Отправить"}
      </button>
      <button
        type="button"
        onClick={() => {
          setOpen(false);
          setError("");
        }}
        className="btn btn-ghost btn-sm"
      >
        Отмена
      </button>
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  );
}

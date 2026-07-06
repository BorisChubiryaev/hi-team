"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateProfile } from "@/app/settings/actions";

export default function ProfileForm({
  initialName,
  email,
}: {
  initialName: string;
  email: string;
}) {
  const [name, setName] = useState(initialName);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function onSave() {
    setError("");
    setSaved(false);
    startTransition(async () => {
      const res = await updateProfile(name);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <div className="card mb-4 p-5">
      <h2 className="font-semibold text-ink">Профиль</h2>
      <p className="mt-0.5 text-sm text-muted">
        Имя и фамилия показываются в отчётах, на дашборде и в аналитике.
      </p>

      <div className="mt-4">
        <label htmlFor="profile-name" className="block text-sm font-medium text-ink">
          Имя и фамилия
        </label>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <input
            id="profile-name"
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setSaved(false);
            }}
            placeholder="Иван Иванов"
            className="input max-w-xs"
          />
          <button
            type="button"
            onClick={onSave}
            disabled={pending || !name.trim() || name.trim() === initialName}
            className="btn btn-primary"
          >
            {pending ? "Сохранение…" : "Сохранить"}
          </button>
          {saved && !pending && (
            <span className="text-sm text-success">Сохранено ✓</span>
          )}
        </div>
        <p className="mt-2 text-xs text-faint">{email}</p>
        {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      </div>
    </div>
  );
}

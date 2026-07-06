import Header from "@/components/Header";
import TelegramConnect from "@/components/TelegramConnect";
import { requireDbUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const me = await requireDbUser();

  return (
    <>
      <Header email={me.email} active="settings" isLead={me.role === "LEAD"} />
      <main className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
        <div className="mb-5">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            Настройки
          </h1>
          <p className="mt-1 text-sm text-muted">{me.name ?? me.email}</p>
        </div>

        <TelegramConnect
          connected={Boolean(me.telegramChatId)}
          username={me.telegramUsername}
        />
      </main>
    </>
  );
}

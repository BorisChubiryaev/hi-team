import Link from "next/link";
import { auth } from "@/lib/auth";

export const metadata = {
  title: "hi-team — еженедельные отчёты команды и AI-сводки",
  description:
    "Одно место для еженедельных отчётов, AI-сводок, проектов и аналитики. Меньше статус-миток — больше ясности для руководителя.",
};

export default async function LandingPage() {
  const session = await auth();
  const loggedIn = Boolean(session?.user);
  const ctaHref = loggedIn ? "/dashboard" : "/login";
  const ctaLabel = loggedIn ? "Открыть дашборд" : "Войти";

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader ctaHref={ctaHref} ctaLabel={ctaLabel} />

      <main className="flex-1">
        <Hero ctaHref={ctaHref} ctaLabel={ctaLabel} />
        <Preview />
        <Features />
        <HowItWorks />
        <Testimonial />
        <CtaBand ctaHref={ctaHref} ctaLabel={ctaLabel} loggedIn={loggedIn} />
      </main>

      <SiteFooter />
    </div>
  );
}

/* --------------------------------------------------------------------- */

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2">
      <span className="flex size-7 items-center justify-center rounded-lg bg-accent text-[15px] font-semibold text-white">
        h
      </span>
      <span className="font-semibold tracking-tight text-ink">hi-team</span>
    </Link>
  );
}

function SiteHeader({
  ctaHref,
  ctaLabel,
}: {
  ctaHref: string;
  ctaLabel: string;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-canvas/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1200px] items-center px-4 sm:px-6">
        <Logo />
        <nav className="ml-auto hidden items-center gap-6 text-sm text-muted sm:flex">
          <a href="#features" className="transition hover:text-ink">
            Возможности
          </a>
          <a href="#how" className="transition hover:text-ink">
            Как работает
          </a>
          <Link href={ctaHref} className="transition hover:text-ink">
            {ctaLabel}
          </Link>
        </nav>
        <Link href={ctaHref} className="btn btn-primary ml-auto sm:ml-6">
          {ctaLabel}
        </Link>
      </div>
    </header>
  );
}

function Hero({ ctaHref, ctaLabel }: { ctaHref: string; ctaLabel: string }) {
  return (
    <section className="relative overflow-hidden">
      <PaintSplash className="pointer-events-none absolute -left-40 -top-10 h-72 w-72 opacity-30 blur-2xl sm:-left-32" />
      <PaintSplash className="pointer-events-none absolute -right-44 top-32 h-80 w-80 rotate-180 opacity-25 blur-2xl sm:-right-36" />

      <div className="mx-auto max-w-[1200px] px-4 pb-16 pt-20 text-center sm:px-6 sm:pb-20 sm:pt-28">
        <span className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-1.5 text-[13px] font-medium text-white shadow-[var(--shadow-soft)]">
          <span className="rounded-full bg-white/25 px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide">
            Новое
          </span>
          AI-сводки за неделю и итоги месяца
        </span>

        <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-semibold leading-[1.03] tracking-[-0.03em] text-ink sm:text-6xl">
          Еженедельные отчёты команды
          <br className="hidden sm:block" /> без хаоса в чатах
        </h1>

        <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-muted">
          Каждый пишет коротко: что сделано, какие блокеры и планы. hi-team
          собирает это в дашборд, AI-сводку для руководителя и аналитику по
          проектам.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href={ctaHref} className="btn btn-primary px-5 py-2.5">
            {ctaLabel}
          </Link>
          <a href="#features" className="btn btn-ghost px-5 py-2.5">
            Как это устроено
          </a>
        </div>
        <p className="mt-4 text-xs text-faint">
          Для команды — вместо статус-миток и переписок в мессенджерах.
        </p>
      </div>
    </section>
  );
}

function Preview() {
  return (
    <section className="mx-auto max-w-[1200px] px-4 pb-8 sm:px-6">
      <div className="overflow-hidden rounded-2xl border border-line bg-card shadow-[var(--shadow-lift)]">
        {/* browser chrome */}
        <div className="flex items-center gap-2 border-b border-line bg-panel px-4 py-3">
          <span className="size-3 rounded-full bg-danger/60" />
          <span className="size-3 rounded-full bg-warn/60" />
          <span className="size-3 rounded-full bg-success/60" />
          <span className="ml-3 text-xs text-faint">
            hi-team · Еженедельные отчёты
          </span>
        </div>

        {/* faux dashboard */}
        <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-3 sm:p-6">
          <PreviewCard
            name="Аня · Дашборд аналитики"
            done="Собрала витрину метрик, свела с бэкендом"
            blockers="Ждём доступ к проду от DevOps"
            plans="Выкатить бету на 3 команды"
          />
          <PreviewCard
            name="Игорь · Биллинг"
            done="Закрыл миграцию тарифов, тесты зелёные"
            plans="Вебхуки для возвратов"
          />
          <div className="rounded-xl border border-cream-ink/15 bg-cream/50 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-cream-ink">
              AI-сводка недели
            </p>
            <p className="mt-2 text-[13px] leading-relaxed text-ink">
              Команда закрыла миграцию тарифов и витрину метрик. Общий блокер —
              доступ к проду от DevOps. На следующей неделе — бета аналитики и
              вебхуки возвратов.
            </p>
            <span className="mt-3 inline-block rounded-full bg-card px-2.5 py-0.5 text-[11px] font-medium text-muted">
              сгенерировано ИИ
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

function PreviewCard({
  name,
  done,
  blockers,
  plans,
}: {
  name: string;
  done: string;
  blockers?: string;
  plans: string;
}) {
  return (
    <div className="rounded-xl border border-line bg-card p-4 shadow-[var(--shadow-soft)]">
      <p className="text-sm font-semibold text-ink">{name}</p>
      <PreviewLine label="Сделано" value={done} tone="text-success" />
      {blockers && (
        <PreviewLine label="Блокеры" value={blockers} tone="text-danger" />
      )}
      <PreviewLine label="Планы" value={plans} tone="text-warn" />
    </div>
  );
}

function PreviewLine({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <div className="mt-2.5">
      <span className={`text-[11px] font-semibold uppercase ${tone}`}>
        {label}
      </span>
      <p className="text-[13px] leading-snug text-muted">{value}</p>
    </div>
  );
}

function Features() {
  const items = [
    {
      icon: <IconCalendar />,
      title: "Еженедельные отчёты",
      text: "Сделано, блокеры и планы по каждому проекту. Черновик подтягивается из планов прошлой недели.",
    },
    {
      icon: <IconSparkles />,
      title: "AI-сводки за неделю",
      text: "Модель собирает отчёты команды в короткий дайджест — то, что нужно руководителю за минуту.",
    },
    {
      icon: <IconFolder />,
      title: "Проекты и история",
      text: "Все направления из отчётов с историей по неделям, статусами и подсказкой «нет движения».",
    },
    {
      icon: <IconChart />,
      title: "Аналитика",
      text: "Дисциплина сдачи, динамика блокеров и активность по проектам — в наглядных графиках.",
    },
    {
      icon: <IconDoc />,
      title: "Итоги месяца",
      text: "Агрегация недель в отчёт «наверх». Экспорт в Markdown вместе с отчётами всех недель.",
    },
    {
      icon: <IconSend />,
      title: "Telegram-бот",
      text: "Напоминания о дедлайне и отправка отчёта прямо из чата — без захода в интерфейс.",
    },
  ];

  return (
    <section id="features" className="mx-auto max-w-[1200px] px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-semibold tracking-[-0.02em] text-ink">
          Всё для недельного ритма команды
        </h2>
        <p className="mt-3 text-muted">
          Один инструмент вместо таблиц, статус-встреч и разрозненных сообщений.
        </p>
      </div>

      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((it) => (
          <div key={it.title} className="card p-6">
            <div className="flex size-10 items-center justify-center rounded-xl bg-panel text-ink">
              {it.icon}
            </div>
            <h3 className="mt-4 text-lg font-semibold text-ink">{it.title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">
              {it.text}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    {
      n: "01",
      title: "Команда заполняет отчёт",
      text: "Раз в неделю, по проектам. Занимает пару минут — черновик уже предзаполнен.",
    },
    {
      n: "02",
      title: "AI собирает сводку",
      text: "Недельный дайджест и итоги месяца — за пару кликов, без ручного пересказа.",
    },
    {
      n: "03",
      title: "Руководитель видит картину",
      text: "Дашборд, аналитика и экспорт для отчётности наверх — всё в одном месте.",
    },
  ];

  return (
    <section id="how" className="border-y border-line bg-panel/50">
      <div className="mx-auto max-w-[1200px] px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-[-0.02em] text-ink">
            Как это работает
          </h2>
          <p className="mt-3 text-muted">
            Три шага от «кто чем занят?» до готового отчёта наверх.
          </p>
        </div>

        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {steps.map((s) => (
            <div key={s.n} className="card p-6">
              <span className="text-sm font-semibold text-accent">{s.n}</span>
              <h3 className="mt-2 text-lg font-semibold text-ink">{s.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">
                {s.text}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Testimonial() {
  return (
    <section className="mx-auto max-w-[1200px] px-4 py-20 sm:px-6">
      <figure className="mx-auto max-w-2xl text-center">
        <blockquote className="text-2xl leading-snug tracking-[-0.01em] text-ink">
          «Раньше статус недели собирался в трёх чатах и таблице.{" "}
          <span className="font-semibold text-accent-ink">
            Теперь я открываю один дашборд и за минуту понимаю, где команда и что
            блокирует.
          </span>
          »
        </blockquote>
        <figcaption className="mt-6 flex items-center justify-center gap-3">
          <span className="flex size-8 items-center justify-center rounded-full bg-cream text-sm font-semibold text-cream-ink">
            М
          </span>
          <span className="text-sm text-muted">
            <span className="font-medium text-ink">Мария К.</span> · руководитель
            продукта
          </span>
        </figcaption>
      </figure>
    </section>
  );
}

function CtaBand({
  ctaHref,
  ctaLabel,
  loggedIn,
}: {
  ctaHref: string;
  ctaLabel: string;
  loggedIn: boolean;
}) {
  return (
    <section className="mx-auto max-w-[1200px] px-4 pb-24 sm:px-6">
      <div className="relative overflow-hidden rounded-3xl border border-line bg-card px-6 py-16 text-center shadow-[var(--shadow-soft)]">
        <PaintSplash className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 opacity-40" />
        <h2 className="relative text-3xl font-semibold tracking-[-0.02em] text-ink">
          Начните вести отчёты по-новому
        </h2>
        <p className="relative mx-auto mt-3 max-w-md text-muted">
          {loggedIn
            ? "Вы уже в команде — откройте дашборд и заполните отчёт за эту неделю."
            : "Войдите под рабочей почтой — доступ открыт участникам команды."}
        </p>
        <div className="relative mt-8">
          <Link href={ctaHref} className="btn btn-primary px-6 py-2.5">
            {ctaLabel}
          </Link>
        </div>
      </div>
    </section>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-[1200px] flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-muted sm:flex-row sm:px-6">
        <Logo />
        <p className="text-xs text-faint">
          © {new Date().getFullYear()} hi-team · Еженедельные отчёты команды
        </p>
        <nav className="flex items-center gap-5">
          <a href="#features" className="transition hover:text-ink">
            Возможности
          </a>
          <a href="#how" className="transition hover:text-ink">
            Как работает
          </a>
        </nav>
      </div>
    </footer>
  );
}

/* --- Декоративный paint-splash (чистая декорация, aria-hidden) --------- */
function PaintSplash({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 200 200"
      className={className}
      fill="none"
    >
      <path
        fill="var(--accent)"
        opacity="0.65"
        d="M46.8 -66.9C59.4 -57.6 67.3 -42.3 71.6 -26.5C75.9 -10.7 76.6 5.6 71.9 20.1C67.2 34.6 57.1 47.3 44.1 57.4C31.1 67.5 15.6 75 -0.9 76.2C-17.3 77.5 -34.6 72.5 -47.9 62.2C-61.2 51.9 -70.5 36.3 -74.7 19.5C-78.9 2.7 -78 -15.3 -70.6 -29.8C-63.2 -44.3 -49.3 -55.3 -35 -63.9C-20.7 -72.5 -5.9 -78.7 8.6 -78.9C23.1 -79.1 34.2 -76.2 46.8 -66.9Z"
        transform="translate(100 100)"
      />
      <path
        fill="var(--accent-ink)"
        opacity="0.35"
        d="M33 -47.5C42.1 -40.8 48.1 -29.9 52.6 -18.1C57.1 -6.3 60.1 6.4 56.9 17.3C53.7 28.2 44.3 37.3 33.4 44.9C22.5 52.5 10.1 58.6 -3.6 63.4C-17.3 68.2 -32.3 71.7 -42.6 65.5C-52.9 59.3 -58.5 43.4 -62 28.2C-65.5 13 -66.9 -1.5 -63 -14.4C-59.1 -27.3 -49.9 -38.6 -38.6 -45C-27.3 -51.4 -13.7 -52.9 -0.6 -52C12.4 -51.1 23.9 -54.2 33 -47.5Z"
        transform="translate(130 90)"
      />
    </svg>
  );
}

/* --- Иконки (monochrome, currentColor, single-weight) ------------------ */
function IconBase({ children }: { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-5"
    >
      {children}
    </svg>
  );
}

function IconCalendar() {
  return (
    <IconBase>
      <rect x="3" y="4.5" width="18" height="16" rx="2.5" />
      <path d="M3 9h18M8 2.5v4M16 2.5v4M7.5 13h3M7.5 16.5h6" />
    </IconBase>
  );
}

function IconSparkles() {
  return (
    <IconBase>
      <path d="M12 3l1.8 4.7L18.5 9.5 13.8 11.3 12 16l-1.8-4.7L5.5 9.5l4.7-1.8L12 3Z" />
      <path d="M18 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8L18 15Z" />
    </IconBase>
  );
}

function IconFolder() {
  return (
    <IconBase>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2.2h6a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
    </IconBase>
  );
}

function IconChart() {
  return (
    <IconBase>
      <path d="M4 20V4M4 20h16M8 20v-6M12.5 20V9M17 20v-9" />
    </IconBase>
  );
}

function IconDoc() {
  return (
    <IconBase>
      <path d="M6 3h8l4 4v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
      <path d="M13.5 3.5V8h4.5M8.5 13h7M8.5 16.5h7" />
    </IconBase>
  );
}

function IconSend() {
  return (
    <IconBase>
      <path d="M21 4L3 11l6 2.5M21 4l-3 16-6-6.5M21 4L9 13.5M9 13.5V19l3-3.5" />
    </IconBase>
  );
}

import Header from "@/components/Header";
import { requireDbUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Гид — hi-team",
  description:
    "О продукте hi-team и инструкция для команды: как сдавать отчёты, что где находится, роли и частые вопросы.",
};

// Скриншоты реального интерфейса (лежат в public/presentation/shots).
const SHOTS = [
  {
    route: "/dashboard",
    src: "/presentation/shots/dashboard.jpg",
    alt: "Дашборд недели с AI-сводкой и отчётами команды",
    title: "Вся команда за неделю + AI-сводка",
    desc: "Кто что сделал по проектам, кто не сдал и деловая выжимка недели для руководителя — на одном экране.",
    tall: true,
  },
  {
    route: "/analytics",
    src: "/presentation/shots/analytics.jpg",
    alt: "Аналитика: дисциплина, блокеры, активность проектов",
    title: "Дисциплина, блокеры, проекты",
    desc: "Сдача по неделям, динамика блокеров, топ и активность проектов.",
  },
  {
    route: "/report",
    src: "/presentation/shots/report.jpg",
    alt: "Форма еженедельного отчёта",
    title: "Отчёт за 3 минуты",
    desc: "Проект → сделано / блокеры / планы. Черновик предзаполнен из прошлой недели.",
  },
  {
    route: "/review",
    src: "/presentation/shots/review.jpg",
    alt: "Подготовка к встрече 1:1",
    title: "Материалы к встрече 1:1",
    desc: "Пресеты кварталов и личный акцент — AI соберёт достижения и темы для разговора.",
  },
  {
    route: "/projects",
    src: "/presentation/shots/projects.jpg",
    alt: "Проекты: статусы, упоминания, последний отчёт",
    title: "Статусы и история проектов",
    desc: "Активные / на паузе / завершённые, число упоминаний и последний отчёт.",
  },
] as const;

const VALUES = [
  "Единая структура вместо свободной таблицы",
  "AI-сводка недели в один клик",
  "Висящие блокеры подсвечиваются сами",
  "Отчёт можно сдать из Telegram",
];

const ROLES = [
  {
    badge: "MEMBER",
    title: "Сотрудник",
    desc: "Пишет еженедельный отчёт и готовится к 1:1.",
  },
  {
    badge: "LEAD",
    title: "Сотрудник-расширенный",
    desc: "Пишет отчёт и управляет: статусы и слияние проектов, раздел «Команда».",
  },
  {
    badge: "DIRECTOR",
    title: "Руководитель",
    desc: "Управляет, но отчёты не пишет — его нет в колонках дашборда и напоминаниях.",
  },
];

const BEFORE = [
  "Каждый пишет как хочет — не сравнить и не собрать.",
  "Руководитель вручную вычитывает всех перед созвоном.",
  "Блокеры тонут и повторяются из недели в неделю.",
  "«Кто не сдал?» — считаем глазами.",
];

const AFTER = [
  "Единая структура: проект → сделано / блокеры / планы.",
  "AI-сводка недели готова в один клик.",
  "Висящие блокеры подсвечиваются автоматически.",
  "«Кто не сдал» — на дашборде, плюс авто-напоминание.",
];

const STEPS = [
  {
    n: "01",
    title: "Сотрудник пишет отчёт",
    desc: "Коротко по каждому проекту. Черновик предзаполнен из прошлой недели, названия проектов подсказываются. Можно прямо из Telegram — одним сообщением.",
  },
  {
    n: "02",
    title: "ИИ собирает сводку",
    desc: "OpenRouter превращает записи в деловую выжимку недели: достижения, риски, висящие блокеры. Вызовы — на сервере, ключ не уходит в браузер.",
  },
  {
    n: "03",
    title: "Руководитель видит ясность",
    desc: "Дашборд неделя × сотрудники, кто не сдал, AI-сводка, статусы проектов и аналитика. Экспорт в Markdown/Word и итоги месяца — для отчёта наверх.",
  },
];

const STACK = [
  { k: "Frontend", v: "Next.js 16", d: "App Router, TypeScript, Tailwind v4" },
  { k: "Auth", v: "Auth.js · NextAuth v5", d: "Credentials, JWT, bcrypt, allowlist" },
  { k: "Данные", v: "Prisma + Neon", d: "Postgres, pooled для serverless" },
  { k: "AI", v: "OpenRouter", d: "Серверные роуты, ключ не в браузере" },
  { k: "Хостинг", v: "Vercel", d: "Deploy + Vercel Cron по расписанию" },
  { k: "Бот", v: "Telegram Bot API", d: "Webhook с проверкой секрета" },
  { k: "Почта", v: "SMTP · Nodemailer", d: "Сводки на любой адрес" },
  { k: "Тема", v: "Campsite UI", d: "Токены, светлая и тёмная" },
];

const ROADMAP = [
  {
    phase: "Есть",
    chip: "готово",
    done: true,
    title: "Ядро продукта",
    desc: "Отчёты, дашборд, AI-сводки недели и месяца, проекты, роли, Telegram-бот, аналитика, подготовка к 1:1, cron-напоминания.",
  },
  {
    phase: "Сейчас",
    chip: "в работе",
    done: false,
    title: "Рассылка сводок на почту",
    desc: "Отправка AI-выжимки письмом через SMTP команды — без домена, на любой адрес.",
  },
  {
    phase: "Дальше",
    chip: "план",
    done: false,
    title: "Глубже в аналитику и ИИ",
    desc: "Дашборды динамики блокеров, rate-limit на AI-роуты, Q&A-чат по истории отчётов.",
  },
];

function Check({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function Cross({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
    >
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

function Shot({
  route,
  src,
  alt,
  title,
  desc,
  tall = false,
}: {
  route: string;
  src: string;
  alt: string;
  title: string;
  desc: string;
  tall?: boolean;
}) {
  return (
    <figure className="card m-0 overflow-hidden">
      <div className="flex items-center gap-1.5 border-b border-line bg-panel px-3 py-2.5">
        <span className="size-2.5 rounded-full bg-line-strong" />
        <span className="size-2.5 rounded-full bg-line-strong" />
        <span className="size-2.5 rounded-full bg-line-strong" />
        <span className="ml-2 truncate rounded-full border border-line bg-card px-2.5 py-0.5 font-mono text-[11px] text-muted">
          hi-team{route}
        </span>
      </div>
      <div
        className={`relative overflow-hidden bg-canvas ${
          tall ? "max-h-[560px]" : "max-h-[420px]"
        }`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} className="block h-auto w-full" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-b from-transparent to-card" />
      </div>
      <figcaption className="px-4 py-4">
        <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
        <p className="mt-1 text-[13px] leading-relaxed text-muted">{desc}</p>
      </figcaption>
    </figure>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold tracking-tight text-ink">{title}</h2>
      <div className="mt-3 text-[15px] leading-relaxed text-muted">
        {children}
      </div>
    </section>
  );
}

export default async function GuidePage() {
  const me = await requireDbUser();
  const [featured, ...rest] = SHOTS;

  return (
    <>
      <Header email={me.email} active="guide" role={me.role} />
      <main className="mx-auto max-w-[1000px] px-4 py-8 sm:px-6">
        {/* Бриф */}
        <div className="max-w-2xl">
          <span className="tag">О продукте</span>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            hi-team — отчёты команды без хаоса в чатах
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-muted">
            Каждый коротко пишет по каждому проекту:{" "}
            <span className="font-medium text-ink">сделано</span>,{" "}
            <span className="font-medium text-ink">блокеры</span>,{" "}
            <span className="font-medium text-ink">планы</span>. hi-team собирает
            это в дашборд, а встроенный ИИ делает сводку недели для руководителя.
            Замена таблице в Confluence и переписке в мессенджерах.
          </p>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {VALUES.map((v) => (
            <div key={v} className="card flex items-start gap-2.5 p-4">
              <svg
                className="mt-0.5 size-4 flex-none text-accent"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20 6 9 17l-5-5" />
              </svg>
              <span className="text-[13.5px] leading-snug text-ink">{v}</span>
            </div>
          ))}
        </div>

        {/* Проблема → решение */}
        <div className="mt-14">
          <h2 className="text-xl font-semibold tracking-tight text-ink">
            Зачем это нужно
          </h2>
          <p className="mt-1 text-sm text-muted">
            Статус-митинги съедают время, а таблица в Confluence теряет контекст.
          </p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-line bg-panel p-5">
              <h3 className="font-mono text-[11px] font-semibold uppercase tracking-wider text-muted">
                Было — свободная таблица
              </h3>
              <ul className="mt-4 space-y-3">
                {BEFORE.map((t) => (
                  <li key={t} className="flex gap-3 text-[14px] text-ink">
                    <Cross className="mt-0.5 size-4 flex-none text-danger" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            <div className="card p-5">
              <h3 className="font-mono text-[11px] font-semibold uppercase tracking-wider text-accent-ink">
                Стало — hi-team
              </h3>
              <ul className="mt-4 space-y-3">
                {AFTER.map((t) => (
                  <li key={t} className="flex gap-3 text-[14px] text-ink">
                    <Check className="mt-0.5 size-4 flex-none text-success" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Как это работает */}
        <div className="mt-14">
          <h2 className="text-xl font-semibold tracking-tight text-ink">
            Как это работает
          </h2>
          <p className="mt-1 text-sm text-muted">
            Три шага в неделю — и картина команды собирается сама.
          </p>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n} className="card p-5">
                <span className="font-mono text-xs font-semibold text-accent">
                  {s.n}
                </span>
                <h3 className="mt-2 text-base font-semibold text-ink">
                  {s.title}
                </h3>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">
                  {s.desc}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Живые экраны */}
        <div className="mt-14">
          <h2 className="text-xl font-semibold tracking-tight text-ink">
            Живые экраны
          </h2>
          <p className="mt-1 text-sm text-muted">
            Реальный интерфейс с данными команды.
          </p>
          <div className="mt-5 grid gap-5">
            <Shot {...featured} />
            <div className="grid gap-5 sm:grid-cols-2">
              {rest.map((s) => (
                <Shot key={s.route} {...s} />
              ))}
            </div>
          </div>
        </div>

        {/* Роли */}
        <div className="mt-14">
          <h2 className="text-xl font-semibold tracking-tight text-ink">
            Три роли
          </h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            {ROLES.map((r) => (
              <div key={r.badge} className="card p-5">
                <span className="tag font-mono text-[11px]">{r.badge}</span>
                <h3 className="mt-3 text-base font-semibold text-ink">
                  {r.title}
                </h3>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">
                  {r.desc}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Стек */}
        <div className="mt-14">
          <h2 className="text-xl font-semibold tracking-tight text-ink">
            Под капотом
          </h2>
          <p className="mt-1 text-sm text-muted">
            Serverless на Vercel, типобезопасность на TypeScript, все AI-вызовы —
            на сервере.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {STACK.map((t) => (
              <div key={t.k} className="card p-4">
                <div className="font-mono text-[10.5px] uppercase tracking-wider text-faint">
                  {t.k}
                </div>
                <div className="mt-1.5 text-[15px] font-semibold text-ink">
                  {t.v}
                </div>
                <div className="mt-1 text-[12.5px] leading-snug text-muted">
                  {t.d}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Роадмап */}
        <div className="mt-14">
          <h2 className="text-xl font-semibold tracking-tight text-ink">
            Куда движемся
          </h2>
          <div className="mt-5 overflow-hidden rounded-xl border border-line">
            {ROADMAP.map((r, i) => (
              <div
                key={r.title}
                className={`grid grid-cols-1 gap-2 px-5 py-4 sm:grid-cols-[150px_1fr] sm:gap-6 ${
                  i ? "border-t border-line" : ""
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[12px] uppercase tracking-wider text-accent-ink">
                    {r.phase}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold uppercase ${
                      r.done
                        ? "bg-success-bg text-success"
                        : "bg-cream text-cream-ink"
                    }`}
                  >
                    {r.chip}
                  </span>
                </div>
                <div>
                  <h3 className="text-[15px] font-semibold text-ink">
                    {r.title}
                  </h3>
                  <p className="mt-1 text-[13.5px] leading-relaxed text-muted">
                    {r.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Инструкция */}
        <div className="mt-16 border-t border-line pt-10">
          <span className="tag">Инструкция</span>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-ink">
            Как пользоваться
          </h2>

          <Section title="Первый вход">
            На странице входа нажмите{" "}
            <span className="font-medium text-ink">
              «Первый вход? Задать пароль»
            </span>
            , введите рабочую почту (она должна быть в списке доступа команды) и
            задайте пароль. Дальше — вход по почте + паролю.
          </Section>

          <Section title="Как сдать отчёт (веб)">
            Откройте <span className="font-medium text-ink">«Мой отчёт»</span>,
            выберите неделю (текущая и три прошлые) и по каждому проекту заполните{" "}
            <span className="font-medium text-ink">Сделано / Блокеры / Планы</span>
            . Если отчёта за неделю ещё нет, форма предзаполнит черновик из
            прошлого отчёта — останется поправить факты.
          </Section>

          <Section title="Как сдать отчёт (Telegram)">
            <ol className="ml-4 list-decimal space-y-1.5">
              <li>
                «Настройки» →{" "}
                <span className="font-medium text-ink">
                  «Подключить Telegram»
                </span>{" "}
                → откройте бота и нажмите Start (привязка по коду).
              </li>
              <li>
                В боте отправьте <code className="text-ink">/report</code> и
                опишите неделю одним сообщением — ИИ разложит по проектам, вы
                подтвердите кнопкой.
              </li>
              <li>
                <code className="text-ink">/status</code> — сдан ли отчёт,{" "}
                <code className="text-ink">/help</code> — справка.
              </li>
            </ol>
          </Section>

          <Section title="Что где находится">
            <div className="overflow-hidden rounded-xl border border-line">
              {[
                ["Отчёты", "Вся команда за неделю, кто не сдал, AI-сводка, экспорт."],
                ["Мой отчёт", "Заполнение отчёта за выбранную неделю."],
                ["К встрече", "Личный AI-разбор вашей работы за период (только для вас)."],
                ["Проекты", "Статусы, история по неделям, AI-статус проекта."],
                ["Месяц", "AI-итоги месяца + выгрузка в Markdown/Word."],
                ["Аналитика", "Дисциплина сдачи, блокеры, активность проектов."],
                ["Команда", "Роли, доступ, список почт (только LEAD/DIRECTOR)."],
              ].map(([k, v], i) => (
                <div
                  key={k}
                  className={`grid grid-cols-[120px_1fr] gap-3 px-4 py-2.5 text-[14px] sm:grid-cols-[160px_1fr] ${
                    i % 2 ? "bg-panel" : "bg-card"
                  }`}
                >
                  <span className="font-medium text-ink">{k}</span>
                  <span className="text-muted">{v}</span>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Подготовка к 1:1">
            Раздел <span className="font-medium text-ink">«К встрече»</span> —
            ваш личный инструмент, руководитель его не видит. По вашим же отчётам
            за период AI соберёт достижения, вклад по проектам, рост и готовые
            реплики «что обсудить с руководителем». Результат можно скопировать
            или выгрузить в Markdown.
          </Section>

          <Section title="Напоминания">
            <span className="font-medium text-ink">Четверг</span> — напоминание
            не сдавшим отчёт. <span className="font-medium text-ink">Пятница</span>{" "}
            — автоматическая AI-сводка недели. Приходят в общий канал и лично в
            Telegram тем, у кого привязан бот.
          </Section>

          <Section title="Частые вопросы">
            <dl className="space-y-3">
              <div>
                <dt className="font-medium text-ink">
                  Не могу войти — «только участникам команды».
                </dt>
                <dd>
                  Ваша почта не в списке доступа. Попросите LEAD/DIRECTOR добавить
                  её в разделе «Команда».
                </dd>
              </div>
              <div>
                <dt className="font-medium text-ink">
                  Можно ли исправить сданный отчёт?
                </dt>
                <dd>
                  Да, откройте «Мой отчёт» за нужную неделю (в пределах текущей и
                  трёх прошлых) и отредактируйте.
                </dd>
              </div>
              <div>
                <dt className="font-medium text-ink">
                  Проект называется по-разному в отчётах.
                </dt>
                <dd>
                  LEAD может переименовать проект или слить дубль в основной в
                  разделе «Проекты» — упоминания перепривяжутся.
                </dd>
              </div>
            </dl>
          </Section>
        </div>
      </main>
    </>
  );
}

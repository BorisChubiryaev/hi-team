# Отпуска сотрудников — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Сотрудник отмечает отпуск в своём отчёте (1–4 недели или «пока не вернусь»), на время отпуска не считается «не сдавшим»; руководитель управляет отпусками в админке.

**Architecture:** Новая Prisma-модель `Vacation` (период в границах недель-понедельников) + модуль `lib/vacations.ts` как единственная точка логики. Потребители: `getWeekStatus` (дашборд/бот), форма отчёта, аналитика, админка, AI-сводка и экспорт.

**Tech Stack:** Next.js 16 (App Router, server actions), Prisma 6 + локальный PostgreSQL 16, Tailwind 4, TypeScript.

**Spec:** `docs/superpowers/specs/2026-07-20-vacations-design.md`

## Global Constraints

- Репозиторий: `/Users/finogenovvladimir/hi-team`, ветка `feature/vacations`. Все команды запускать из корня репо.
- Весь пользовательский текст — на русском.
- Prisma CLI не читает `.env` сам (проект использует `prisma.config.ts`): перед любой prisma-командой выполнять `set -a; source .env; set +a` в той же shell-сессии.
- Тест-фреймворка в проекте нет. Проверка каждой задачи: `npm run build` (включает типизацию); поведение проверяется через dev-сервер и `psql -d hiteam` (задачи 5, 6, 8, 10). Это осознанное отступление от TDD, зафиксированное в спеке.
- Dev-сервер уже может быть запущен (порт 3000, launch-конфиг `hi-team-dev`); Next.js подхватывает правки горячо, после смены схемы Prisma сервер нужно перезапустить.
- Конвенция дат: все границы недель — понедельники в UTC (см. `lib/weeks.ts:mondayOf`). `Vacation.endDate` — понедельник ПОСЛЕДНЕЙ недели отпуска (включительно), `null` = открытый отпуск.
- Коммит в конце каждой задачи. Сообщения — `feat: …` на русском, с трейлером `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

### Task 1: Модель Vacation в схеме БД

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Produces: Prisma-модель `Vacation { id, userId, startDate: Date, endDate: Date | null, createdById: string | null, createdAt, updatedAt }` и relation `User.vacations`.

- [ ] **Step 1: Добавить relation в модель User**

В `prisma/schema.prisma` в модели `User` после строки `reviewPreps  ReviewPrep[]` добавить:

```prisma
  vacations    Vacation[]
```

- [ ] **Step 2: Добавить модель Vacation**

Сразу после закрывающей скобки модели `User` вставить:

```prisma
// Отпуск сотрудника. Гранулярность — рабочая неделя: startDate/endDate —
// понедельники (конвенция Week.startDate). endDate — понедельник ПОСЛЕДНЕЙ
// недели отпуска включительно; null = «пока не вернусь» (закрывается первым
// сданным отчётом). Инвариант: не больше одного актуального отпуска на
// пользователя (обеспечивается кодом в lib/vacations.ts, не схемой).
model Vacation {
  id          String    @id @default(cuid())
  userId      String
  startDate   DateTime  @db.Date
  endDate     DateTime? @db.Date
  createdById String? // кто оформил: сам сотрудник или руководитель
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, startDate])
}
```

- [ ] **Step 3: Применить схему к локальной БД**

```bash
cd /Users/finogenovvladimir/hi-team && set -a; source .env; set +a && npx prisma db push
```

Expected: `Your database is now in sync with your Prisma schema` (и перегенерация клиента).

- [ ] **Step 4: Проверить, что таблица создана**

```bash
psql -d hiteam -c '\d "Vacation"'
```

Expected: таблица с колонками `id, userId, startDate, endDate, createdById, createdAt, updatedAt` и индексом по `(userId, startDate)`.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma && git commit -m "feat: модель Vacation в схеме БД

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Модуль lib/vacations.ts

**Files:**
- Create: `lib/vacations.ts`

**Interfaces:**
- Consumes: модель `Vacation` из Task 1; `currentWeekRange`, `isoDate`, `mondayOf` из `@/lib/weeks`.
- Produces (используется задачами 3–9):
  - `addWeeks(weekStart: Date, n: number): Date`
  - `getVacationingUserIds(weekStart: Date): Promise<Set<string>>`
  - `getVacationsByWeek(weekStarts: Date[]): Promise<Map<string, Set<string>>>` — ключ `isoDate(понедельника)`
  - `getActiveVacation(userId: string): Promise<Vacation | null>`
  - `setVacation(userId: string, startWeek: Date, weeks: number | null, createdById: string | null): Promise<void>`
  - `cancelUpcomingVacation(userId: string, afterWeek: Date): Promise<void>`
  - `endVacationNow(userId: string): Promise<void>`
  - `closeVacationOnReport(userId: string, weekStart: Date): Promise<void>`

- [ ] **Step 1: Создать файл целиком**

```ts
// Отпуска сотрудников. Гранулярность — рабочая неделя: границы хранятся как
// понедельники (конвенция Week.startDate, всё в UTC). Инвариант: у
// пользователя не больше одного «актуального» отпуска (endDate = null —
// «пока не вернусь» — или endDate >= понедельника текущей недели).
// Исторические отпуска не изменяются — по ним аналитика считает прошлые недели.

import type { Vacation } from "@prisma/client";
import { prisma } from "@/lib/db";
import { currentWeekRange, isoDate, mondayOf } from "@/lib/weeks";

/** Понедельник через n недель от данного (n может быть отрицательным). */
export function addWeeks(weekStart: Date, n: number): Date {
  const d = new Date(weekStart);
  d.setUTCDate(d.getUTCDate() + 7 * n);
  return d;
}

/** Prisma-условие «отпуск покрывает неделю weekStart». */
function covers(weekStart: Date) {
  return {
    startDate: { lte: weekStart },
    OR: [{ endDate: null }, { endDate: { gte: weekStart } }],
  };
}

/** id всех, у кого неделя weekStart покрыта отпуском. */
export async function getVacationingUserIds(
  weekStart: Date,
): Promise<Set<string>> {
  const rows = await prisma.vacation.findMany({
    where: covers(weekStart),
    select: { userId: true },
  });
  return new Set(rows.map((r) => r.userId));
}

/**
 * Отпускники по неделям одним запросом: ключ — isoDate(понедельника),
 * значение — набор userId. Для дашборда и аналитики.
 */
export async function getVacationsByWeek(
  weekStarts: Date[],
): Promise<Map<string, Set<string>>> {
  const result = new Map<string, Set<string>>(
    weekStarts.map((w) => [isoDate(w), new Set<string>()]),
  );
  if (weekStarts.length === 0) return result;
  const min = new Date(Math.min(...weekStarts.map((w) => w.getTime())));
  const max = new Date(Math.max(...weekStarts.map((w) => w.getTime())));
  const rows = await prisma.vacation.findMany({
    where: {
      startDate: { lte: max },
      OR: [{ endDate: null }, { endDate: { gte: min } }],
    },
    select: { userId: true, startDate: true, endDate: true },
  });
  for (const w of weekStarts) {
    const set = result.get(isoDate(w))!;
    for (const v of rows) {
      if (v.startDate <= w && (v.endDate === null || v.endDate >= w)) {
        set.add(v.userId);
      }
    }
  }
  return result;
}

/** Актуальный (идущий или будущий) отпуск пользователя, null если нет. */
export async function getActiveVacation(
  userId: string,
): Promise<Vacation | null> {
  const { start } = currentWeekRange();
  return prisma.vacation.findFirst({
    where: {
      userId,
      OR: [{ endDate: null }, { endDate: { gte: start } }],
    },
    orderBy: { startDate: "desc" },
  });
}

/**
 * Создаёт или заменяет актуальный отпуск: с недели startWeek на weeks недель
 * (null = «пока не вернусь»).
 */
export async function setVacation(
  userId: string,
  startWeek: Date,
  weeks: number | null,
  createdById: string | null,
): Promise<void> {
  const startDate = mondayOf(startWeek);
  const endDate =
    weeks && weeks > 0 ? addWeeks(startDate, Math.floor(weeks) - 1) : null;
  const existing = await getActiveVacation(userId);
  if (existing) {
    await prisma.vacation.update({
      where: { id: existing.id },
      data: { startDate, endDate, createdById },
    });
  } else {
    await prisma.vacation.create({
      data: { userId, startDate, endDate, createdById },
    });
  }
}

/**
 * Удаляет актуальный отпуск, начинающийся строго после недели afterWeek, —
 * сотрудник снял галочку «в отпуске» в отчёте за неделю afterWeek.
 * Уже идущий отпуск не трогаем: его закрывает closeVacationOnReport.
 */
export async function cancelUpcomingVacation(
  userId: string,
  afterWeek: Date,
): Promise<void> {
  const { start } = currentWeekRange();
  await prisma.vacation.deleteMany({
    where: {
      userId,
      startDate: { gt: afterWeek },
      OR: [{ endDate: null }, { endDate: { gte: start } }],
    },
  });
}

/**
 * Досрочно завершает актуальный отпуск (админка): ещё не начавшийся —
 * удаляется, идущий — закрывается прошлой неделей.
 */
export async function endVacationNow(userId: string): Promise<void> {
  const v = await getActiveVacation(userId);
  if (!v) return;
  const { start } = currentWeekRange();
  if (v.startDate >= start) {
    await prisma.vacation.delete({ where: { id: v.id } });
  } else {
    await prisma.vacation.update({
      where: { id: v.id },
      data: { endDate: addWeeks(start, -1) },
    });
  }
}

/**
 * Автовозврат по отчёту: непустой отчёт за неделю weekStart закрывает
 * покрывающий её отпуск. Отпуск, начинавшийся этой же неделей (или позже),
 * удаляется целиком; начавшийся раньше — усекается прошлой неделей.
 * ВАЖНО: при сохранении отчёта вызывать ДО setVacation — иначе сценарий
 * «вышел из отпуска и сразу планирую новый» затрёт только что созданный.
 */
export async function closeVacationOnReport(
  userId: string,
  weekStart: Date,
): Promise<void> {
  const monday = mondayOf(weekStart);
  const v = await prisma.vacation.findFirst({
    where: { userId, ...covers(monday) },
  });
  if (!v) return;
  if (v.startDate.getTime() >= monday.getTime()) {
    await prisma.vacation.delete({ where: { id: v.id } });
  } else {
    await prisma.vacation.update({
      where: { id: v.id },
      data: { endDate: addWeeks(monday, -1) },
    });
  }
}
```

- [ ] **Step 2: Проверить типизацию сборкой**

```bash
cd /Users/finogenovvladimir/hi-team && npm run build
```

Expected: сборка зелёная, без ошибок типов.

- [ ] **Step 3: Commit**

```bash
git add lib/vacations.ts && git commit -m "feat: модуль логики отпусков lib/vacations.ts

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Интеграция в сохранение отчёта

**Files:**
- Modify: `lib/reports.ts`
- Modify: `app/report/actions.ts`

**Interfaces:**
- Consumes: `closeVacationOnReport`, `setVacation`, `cancelUpcomingVacation`, `addWeeks` из Task 2.
- Produces:
  - `saveUserReport(userId, weekStartIso, projects, vacation?: { enabled: boolean; weeks: number | null })` — 4-й параметр опционален; Telegram-бот (`lib/bot.ts`) его не передаёт и продолжает работать без правок.
  - server action `saveReport(weekStartIso, projects, vacation?: { enabled: boolean; weeks: number | null })` — используется формой в Task 5.

- [ ] **Step 1: Расширить saveUserReport в lib/reports.ts**

Добавить импорт после существующих:

```ts
import {
  addWeeks,
  cancelUpcomingVacation,
  closeVacationOnReport,
  setVacation,
} from "@/lib/vacations";
```

Изменить сигнатуру (docstring дополнить строкой про отпуск):

```ts
/**
 * Создаёт/обновляет отчёт пользователя за выбранную неделю. Разрешены только
 * текущая и три прошлые недели. Возвращает число сохранённых проектов.
 * vacation: отметка «со следующей недели в отпуске» из веб-формы; бот
 * параметр не передаёт — тогда отпуска не трогаем (кроме автовозврата).
 */
export async function saveUserReport(
  userId: string,
  weekStartIso: string,
  projects: ProjectInput[],
  vacation?: { enabled: boolean; weeks: number | null },
): Promise<number> {
```

В конце функции, между существующим `await prisma.$transaction([...]);` и `return cleaned.length;`, добавить:

```ts
  // Автовозврат: непустой отчёт закрывает отпуск, покрывающий его неделю.
  // Порядок важен: сначала закрываем старый, потом создаём отмеченный в форме.
  if (cleaned.length > 0) {
    await closeVacationOnReport(userId, target.start);
  }
  if (vacation) {
    if (vacation.enabled) {
      await setVacation(userId, addWeeks(target.start, 1), vacation.weeks, userId);
    } else {
      await cancelUpcomingVacation(userId, target.start);
    }
  }
```

- [ ] **Step 2: Пробросить параметр через server action**

В `app/report/actions.ts` изменить `saveReport`:

```ts
/** Сохраняет отчёт текущего пользователя за выбранную неделю (по умолчанию — текущую). */
export async function saveReport(
  weekStartIso: string,
  projects: ProjectInput[],
  vacation?: { enabled: boolean; weeks: number | null },
): Promise<SaveResult> {
  try {
    const user = await requireUser();
    const week = weekStartIso || isoDate(currentWeekRange().start);
    await saveUserReport(user.id, week, projects, vacation);

    revalidatePath("/dashboard");
    revalidatePath("/report");
    revalidatePath("/projects");
    revalidatePath("/admin");
    return { ok: true };
  } catch (e) {
    if (isNextControlFlow(e)) throw e; // redirect на /login и т.п.
    console.error("saveReport failed:", e);
    const msg = e instanceof Error ? e.message : "Неизвестная ошибка";
    return { ok: false, error: `Не удалось сохранить: ${msg}` };
  }
}
```

(Изменения: параметр `vacation`, его проброс, `revalidatePath("/admin")`.)

- [ ] **Step 3: Проверить сборку**

```bash
cd /Users/finogenovvladimir/hi-team && npm run build
```

Expected: зелёная сборка (существующие вызовы `saveUserReport` в `lib/bot.ts` компилируются — параметр опционален).

- [ ] **Step 4: Commit**

```bash
git add lib/reports.ts app/report/actions.ts && git commit -m "feat: отметка отпуска и автовозврат при сохранении отчёта

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Статус недели — корзина «в отпуске» и ростер бота

**Files:**
- Modify: `lib/reminders.ts`

**Interfaces:**
- Consumes: `getVacationingUserIds` из Task 2.
- Produces: `getWeekStatus(): Promise<{ label: string; submitted: UserLite[]; vacation: UserLite[]; missing: UserLite[] }>` — новая корзина `vacation`; `missing` больше не содержит отпускников. Используется в Task 10 (админ-кнопки «отправить сейчас» уже её зовут).

- [ ] **Step 1: Добавить корзину vacation в getWeekStatus**

Импорт после существующих:

```ts
import { getVacationingUserIds } from "@/lib/vacations";
```

Заменить `getWeekStatus` целиком:

```ts
/** Кто сдал / кто в отпуске / кто не сдал за текущую неделю (среди активных). */
export async function getWeekStatus(): Promise<{
  label: string;
  submitted: UserLite[];
  vacation: UserLite[];
  missing: UserLite[];
}> {
  const { start, end } = currentWeekRange();
  const label = formatWeekLabel(start, end);

  const [users, week, vacationIds] = await Promise.all([
    // Отчёт ждём только от пишущих его ролей (Руководитель не пишет).
    prisma.user.findMany({
      where: { active: true, role: { not: "DIRECTOR" } },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, email: true, telegramChatId: true },
    }),
    prisma.week.findUnique({
      where: { startDate: start },
      include: { reports: { include: { projects: true } } },
    }),
    getVacationingUserIds(start),
  ]);

  const submittedIds = new Set(
    (week?.reports ?? [])
      .filter((r) => r.projects.length > 0)
      .map((r) => r.userId),
  );
  // Сдавший в отпуске считается сдавшим (автовозврат закроет отпуск).
  return {
    label,
    submitted: users.filter((u) => submittedIds.has(u.id)),
    vacation: users.filter(
      (u) => !submittedIds.has(u.id) && vacationIds.has(u.id),
    ),
    missing: users.filter(
      (u) => !submittedIds.has(u.id) && !vacationIds.has(u.id),
    ),
  };
}
```

`sendReminders` не меняется: `missing` уже без отпускников, напоминания им не уходят, а «все сдали» срабатывает, когда сдали все не-отпускники.

- [ ] **Step 2: Строка отпускников в групповом ростере**

Заменить `sendGroupRoster` целиком:

```ts
/** Ростер в общий чат: кто сдал / в отпуске / кто нет (или «сдали все»). */
export async function sendGroupRoster(chatId: string): Promise<boolean> {
  const { label, submitted, vacation, missing } = await getWeekStatus();

  const vacationLine = vacation.length
    ? `\n🏖 В отпуске (${vacation.length}): ${vacation.map(nameOf).join(", ")}`
    : "";

  let text: string;
  if (missing.length === 0) {
    text = `✅ Отчёты за неделю ${label}: сдали все (${submitted.length}). Спасибо команде!${vacationLine}`;
  } else {
    const done = submitted.length ? submitted.map(nameOf).join(", ") : "—";
    const not = missing.map(nameOf).join(", ");
    text =
      `📋 Отчёты за неделю ${label}\n\n` +
      `✅ Сдали (${submitted.length}): ${done}\n` +
      `⏳ Не сдали (${missing.length}): ${not}${vacationLine}\n\n` +
      `Заполнить: ${appUrl()}/report`;
  }
  return sendTelegram(chatId, text);
}
```

- [ ] **Step 3: Проверить сборку**

```bash
cd /Users/finogenovvladimir/hi-team && npm run build
```

Expected: зелёная сборка.

- [ ] **Step 4: Commit**

```bash
git add lib/reminders.ts && git commit -m "feat: отпускники в статусе недели и ростере бота

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Галочка отпуска в форме отчёта

**Files:**
- Modify: `app/report/page.tsx`
- Modify: `components/ReportForm.tsx`

**Interfaces:**
- Consumes: `getActiveVacation` (Task 2), action `saveReport(weekStartIso, projects, vacation)` (Task 3).
- Produces: проп `initialVacation: { enabled: boolean; weeks: number | null }` у `ReportForm`.

- [ ] **Step 1: Предзаполнение в app/report/page.tsx**

Импорт после существующих:

```ts
import { getActiveVacation } from "@/lib/vacations";
```

После блока с `projectNames` (перед `return`) добавить:

```ts
  // Актуальный отпуск, начинающийся после недели отчёта, — предзаполняет
  // галочку «со следующей недели я в отпуске».
  const activeVacation = await getActiveVacation(user.id);
  const upcoming =
    activeVacation && activeVacation.startDate > selected.start
      ? activeVacation
      : null;
  const initialVacation = upcoming
    ? {
        enabled: true,
        weeks: upcoming.endDate
          ? Math.round(
              (upcoming.endDate.getTime() - upcoming.startDate.getTime()) /
                (7 * 24 * 60 * 60 * 1000),
            ) + 1
          : null,
      }
    : { enabled: false, weeks: null };
```

В JSX передать проп:

```tsx
        <ReportForm
          key={selectedIso}
          weekStartIso={selectedIso}
          initialProjects={initialProjects}
          projectNames={projectNames}
          draftFromLabel={draftFromLabel}
          initialVacation={initialVacation}
        />
```

- [ ] **Step 2: Блок отпуска в components/ReportForm.tsx**

Расширить пропсы и состояние:

```tsx
export default function ReportForm({
  weekStartIso,
  initialProjects,
  projectNames = [],
  draftFromLabel = null,
  initialVacation = { enabled: false, weeks: null },
}: {
  weekStartIso: string;
  initialProjects: ProjectInput[];
  projectNames?: string[];
  draftFromLabel?: string | null;
  initialVacation?: { enabled: boolean; weeks: number | null };
}) {
```

После `const [error, setError] = useState("");` добавить:

```tsx
  const [vacationEnabled, setVacationEnabled] = useState(
    initialVacation.enabled,
  );
  const [vacationWeeks, setVacationWeeks] = useState<string>(
    initialVacation.weeks ? String(initialVacation.weeks) : "open",
  );
```

Заменить `onSave`:

```tsx
  function onSave() {
    setError("");
    startTransition(async () => {
      const vacation = {
        enabled: vacationEnabled,
        weeks: vacationWeeks === "open" ? null : Number(vacationWeeks),
      };
      const res = await saveReport(weekStartIso, projects, vacation);
      if (res.ok) {
        setSaved(true);
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }
```

Между списком проектов (`{projects.map(...)}` … `))}` ) и блоком кнопок `<div className="flex flex-wrap items-center gap-3">` вставить:

```tsx
      <div className="card p-5">
        <label className="flex items-center gap-2 text-sm font-medium text-ink">
          <input
            type="checkbox"
            checked={vacationEnabled}
            onChange={(e) => {
              setVacationEnabled(e.target.checked);
              setSaved(false);
            }}
            className="h-4 w-4 accent-[var(--accent)]"
          />
          Со следующей недели я в отпуске
        </label>
        {vacationEnabled && (
          <label className="mt-3 flex items-center gap-2 text-sm text-muted">
            Срок:
            <select
              value={vacationWeeks}
              onChange={(e) => {
                setVacationWeeks(e.target.value);
                setSaved(false);
              }}
              className="input w-auto"
            >
              <option value="1">1 неделя</option>
              <option value="2">2 недели</option>
              <option value="3">3 недели</option>
              <option value="4">4 недели</option>
              <option value="open">пока не вернусь</option>
            </select>
          </label>
        )}
        <p className="mt-2 text-xs text-faint">
          В отпуске отчёт не требуется: вы не попадаете в «не сдали» и не
          получаете напоминания. Первый же сданный отчёт завершает отпуск.
        </p>
      </div>
```

- [ ] **Step 3: Проверить в браузере и БД**

Dev-сервер должен работать (`preview_start` c конфигом `hi-team-dev`). Открыть `http://localhost:3000/report`:
1. Отметить галочку, выбрать «2 недели», сохранить. Expected: «Сохранено ✓».
2. Проверить БД:

```bash
psql -d hiteam -c 'select "userId", "startDate", "endDate" from "Vacation";'
```

Expected: одна строка, `startDate` = понедельник следующей недели, `endDate` = `startDate` + 7 дней.
3. Перезагрузить `/report`. Expected: галочка стоит, в селекте «2 недели».
4. Снять галочку, сохранить, проверить БД тем же запросом. Expected: 0 строк.

- [ ] **Step 4: Проверить сборку**

```bash
cd /Users/finogenovvladimir/hi-team && npm run build
```

Expected: зелёная сборка.

- [ ] **Step 5: Commit**

```bash
git add app/report/page.tsx components/ReportForm.tsx && git commit -m "feat: галочка отпуска в форме отчёта

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Дашборд — отпускники в баннере и карточках недель

**Files:**
- Modify: `app/dashboard/page.tsx`

**Interfaces:**
- Consumes: `getVacationsByWeek` (Task 2).

- [ ] **Step 1: Загрузка отпусков и три корзины**

Импорты: к `import { currentWeekRange } from "@/lib/weeks";` добавить `isoDate`; новый импорт `getVacationsByWeek`:

```ts
import { currentWeekRange, isoDate } from "@/lib/weeks";
import { getVacationsByWeek } from "@/lib/vacations";
```

После `Promise.all([...])` (после строки `]);`) добавить:

```ts
  // Отпускники по каждой показанной неделе + текущей (для баннера).
  const vacByWeek = await getVacationsByWeek([
    start,
    ...weeks.map((w) => w.startDate),
  ]);
  const vacOf = (weekStart: Date) =>
    vacByWeek.get(isoDate(weekStart)) ?? new Set<string>();
```

Заменить вычисление `missing` (баннер):

```ts
  const missing = users.filter(
    (u) => !submitted.has(u.id) && !vacOf(start).has(u.id),
  );
```

- [ ] **Step 2: Карточка недели в ленте**

Внутри `weeks.map((w, i) => { ... })` заменить вычисление `submittedUsers`/`missingUsers`:

```ts
              const vacSet = vacOf(w.startDate);
              const submittedUsers = users.filter(
                (u) => (userMap.get(u.id)?.length ?? 0) > 0,
              );
              const vacationUsers = users.filter(
                (u) =>
                  (userMap.get(u.id)?.length ?? 0) === 0 && vacSet.has(u.id),
              );
              const missingUsers = users.filter(
                (u) =>
                  (userMap.get(u.id)?.length ?? 0) === 0 && !vacSet.has(u.id),
              );
```

Счётчик в `<summary>` — знаменатель без отпускников:

```tsx
                        сдали {submittedUsers.length}/
                        {users.length - vacationUsers.length}
```

После блока `{missingUsers.length > 0 && (...)}` добавить аналогичный блок отпускников:

```tsx
                    {vacationUsers.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-xs text-muted">В отпуске:</span>
                        {vacationUsers.map((u) => (
                          <span
                            key={u.id}
                            className="rounded-full bg-cream/60 px-2 py-0.5 text-xs text-cream-ink"
                          >
                            🏖 {displayName(u)}
                          </span>
                        ))}
                      </div>
                    )}
```

Табличное представление не меняем (пустая ячейка остаётся «—»).

- [ ] **Step 3: Проверить в браузере**

Оформить себе отпуск с текущей недели через psql (быстрее, чем ждать следующей недели; `<uid>` — ваш id):

```bash
psql -d hiteam -c 'select id, email from "User";'
psql -d hiteam -c "insert into \"Vacation\" (id, \"userId\", \"startDate\", \"updatedAt\") values ('test-vac-1', '<uid>', date_trunc('week', now())::date, now());"
```

Открыть `http://localhost:3000/dashboard`. Expected: вы НЕ в баннере «Ещё не сдали», в свежей карточке — чип «🏖 …», счётчик «сдали N/M» с уменьшенным M. Удалить тестовую запись:

```bash
psql -d hiteam -c "delete from \"Vacation\" where id = 'test-vac-1';"
```

- [ ] **Step 4: Сборка и commit**

```bash
cd /Users/finogenovvladimir/hi-team && npm run build
git add app/dashboard/page.tsx && git commit -m "feat: отпускники на дашборде — баннер, чипы, счётчики

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: Аналитика — отпуск вне знаменателя дисциплины

**Files:**
- Modify: `lib/analytics.ts`
- Modify: `app/analytics/page.tsx`

**Interfaces:**
- Consumes: `getVacationsByWeek` (Task 2).
- Produces: `Analytics.tiles.eligibleThisWeek: number` — сколько человек обязаны сдать отчёт на этой неделе (команда минус отпускники).

- [ ] **Step 1: lib/analytics.ts**

Импорт:

```ts
import { getVacationsByWeek } from "@/lib/vacations";
```

В тип `Analytics` в `tiles` после `submittedThisWeek: number;` добавить:

```ts
    /** Сколько человек обязаны сдать на этой неделе (без отпускников). */
    eligibleThisWeek: number;
```

После блока `Promise.all([...])` добавить:

```ts
  // Отпускники по неделям периода + текущей (недели без Week-записи тоже).
  const vacByWeek = await getVacationsByWeek([
    currentStart,
    ...weeks.map((w) => w.startDate),
  ]);
  const vacOf = (w: { startDate: Date }) =>
    vacByWeek.get(isoDate(w.startDate)) ?? new Set<string>();
  const vacCur = vacOf({ startDate: currentStart });
```

Дисциплина — отпускники вне числителя:

```ts
  const discipline: WeekPoint[] = chrono.map((w) => ({
    label: w.label,
    value: filteredWeek(w).filter(
      (r) => r.projects.length > 0 && !vacOf(w).has(r.userId),
    ).length,
  }));
```

В `tiles`: заменить `submittedThisWeek` и добавить `eligibleThisWeek` (сразу после него):

```ts
      submittedThisWeek: currentWeek
        ? filteredWeek(currentWeek).filter(
            (r) => r.projects.length > 0 && !vacCur.has(r.userId),
          ).length
        : 0,
      eligibleThisWeek:
        teamSize -
        activeUsers.filter(
          (u) => vacCur.has(u.id) && (!userId || u.id === userId),
        ).length,
```

- [ ] **Step 2: app/analytics/page.tsx**

Плитка «Сдано на этой неделе»:

```tsx
          <StatTile
            label="Сдано на этой неделе"
            value={`${a.tiles.submittedThisWeek} из ${a.tiles.eligibleThisWeek}`}
          />
```

Подзаголовок графика дисциплины:

```tsx
          <ChartCard
            title="Сдача отчётов по неделям"
            subtitle={`Сколько человек из ${a.teamSize} сдали отчёт; отпуска не считаются`}
          >
```

- [ ] **Step 3: Проверить в браузере**

Снова вставить тестовый отпуск (см. Task 6 Step 3), открыть `http://localhost:3000/analytics`. Expected: «Сдано на этой неделе: X из Y», где Y на 1 меньше размера команды. Удалить тестовую запись.

- [ ] **Step 4: Сборка и commit**

```bash
cd /Users/finogenovvladimir/hi-team && npm run build
git add lib/analytics.ts app/analytics/page.tsx && git commit -m "feat: отпуска исключены из дисциплины сдачи в аналитике

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 8: Админка — управление отпусками

**Files:**
- Modify: `app/admin/actions.ts`
- Modify: `app/admin/page.tsx`
- Modify: `components/AdminUserRow.tsx`

**Interfaces:**
- Consumes: `setVacation`, `endVacationNow`, `addWeeks` (Task 2).
- Produces: server actions `setUserVacation(userId, fromWeek: "current" | "next", weeks: number | null)` и `endUserVacation(userId)`; проп `vacation: { label: string; started: boolean } | null` у `AdminUserRow`.

- [ ] **Step 1: Server actions в app/admin/actions.ts**

Импорты:

```ts
import { addWeeks, endVacationNow, setVacation } from "@/lib/vacations";
import { currentWeekRange } from "@/lib/weeks";
```

В конец файла добавить:

```ts
/** Оформляет отпуск сотруднику с текущей или следующей недели. Только LEAD/DIRECTOR. */
export async function setUserVacation(
  userId: string,
  fromWeek: "current" | "next",
  weeks: number | null,
): Promise<ActionResult> {
  const me = await requireManager();
  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) return { ok: false, error: "Пользователь не найден" };
  if (weeks !== null && (!Number.isInteger(weeks) || weeks < 1 || weeks > 4)) {
    return { ok: false, error: "Срок — 1–4 недели или открытый" };
  }
  const { start } = currentWeekRange();
  await setVacation(
    userId,
    fromWeek === "next" ? addWeeks(start, 1) : start,
    weeks,
    me.id,
  );
  revalidatePath("/admin");
  revalidatePath("/dashboard");
  return { ok: true };
}

/** Досрочно завершает отпуск сотрудника (ещё не начавшийся — отменяет). */
export async function endUserVacation(userId: string): Promise<ActionResult> {
  await requireManager();
  await endVacationNow(userId);
  revalidatePath("/admin");
  revalidatePath("/dashboard");
  return { ok: true };
}
```

- [ ] **Step 2: Загрузка отпусков в app/admin/page.tsx**

Импорты:

```ts
import { currentWeekRange, formatDateHuman } from "@/lib/weeks";
```

Расширить `Promise.all` и подготовить данные (заменить существующий блок):

```ts
  const { start: weekStart } = currentWeekRange();
  const [users, allowed, bot, vacations] = await Promise.all([
    prisma.user.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.allowedEmail.findMany({ orderBy: { email: "asc" } }),
    prisma.botSettings.findUnique({ where: { id: "singleton" } }),
    prisma.vacation.findMany({
      where: { OR: [{ endDate: null }, { endDate: { gte: weekStart } }] },
    }),
  ]);
  const vacationByUser = new Map(vacations.map((v) => [v.userId, v]));

  // «с 27 июля по 7 августа» / «с 27 июля, до возвращения»;
  // конец показываем пятницей последней недели.
  const vacationLabel = (v: { startDate: Date; endDate: Date | null }) => {
    const from = `с ${formatDateHuman(v.startDate)}`;
    if (!v.endDate) return `${from}, до возвращения`;
    const friday = new Date(v.endDate);
    friday.setUTCDate(friday.getUTCDate() + 4);
    return `${from} по ${formatDateHuman(friday)}`;
  };
```

В таблице: добавить заголовок после `<Th>Доступ</Th>`:

```tsx
                <Th>Отпуск</Th>
```

и передать проп в строку:

```tsx
              {users.map((u) => {
                const v = vacationByUser.get(u.id);
                return (
                  <AdminUserRow
                    key={u.id}
                    user={u}
                    isSelf={u.id === me.id}
                    vacation={
                      v
                        ? { label: vacationLabel(v), started: v.startDate <= weekStart }
                        : null
                    }
                  />
                );
              })}
```

- [ ] **Step 3: Ячейка отпуска в components/AdminUserRow.tsx**

Дополнить импорт actions:

```tsx
import {
  deleteUser,
  endUserVacation,
  setUserActive,
  setUserRole,
  setUserTelegram,
  setUserVacation,
} from "@/app/admin/actions";
```

Пропсы: добавить `vacation`:

```tsx
export default function AdminUserRow({
  user,
  isSelf,
  vacation,
}: {
  user: {
    id: string;
    name: string | null;
    email: string;
    role: Role;
    active: boolean;
    telegramChatId: string | null;
  };
  isSelf: boolean;
  vacation: { label: string; started: boolean } | null;
}) {
```

Состояние после `const [telegram, ...]`:

```tsx
  const [vacFrom, setVacFrom] = useState<"current" | "next">("next");
  const [vacWeeks, setVacWeeks] = useState("1");
```

Новая ячейка `<td>` между ячейкой «Доступ» (checkbox) и ячейкой Telegram:

```tsx
      <td className="p-3">
        {vacation ? (
          <div className="text-sm">
            <p className="whitespace-nowrap text-ink">🏖 {vacation.label}</p>
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => endUserVacation(user.id))}
              className="mt-1 text-xs text-danger transition hover:underline disabled:opacity-40"
            >
              {vacation.started ? "Завершить досрочно" : "Отменить"}
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-1.5">
            <select
              value={vacFrom}
              disabled={pending}
              onChange={(e) => setVacFrom(e.target.value as "current" | "next")}
              className={inputClass}
              aria-label="Отпуск с недели"
            >
              <option value="current">с текущей</option>
              <option value="next">со следующей</option>
            </select>
            <select
              value={vacWeeks}
              disabled={pending}
              onChange={(e) => setVacWeeks(e.target.value)}
              className={inputClass}
              aria-label="Срок отпуска"
            >
              <option value="1">1 нед.</option>
              <option value="2">2 нед.</option>
              <option value="3">3 нед.</option>
              <option value="4">4 нед.</option>
              <option value="open">открытый</option>
            </select>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                run(() =>
                  setUserVacation(
                    user.id,
                    vacFrom,
                    vacWeeks === "open" ? null : Number(vacWeeks),
                  ),
                )
              }
              className="rounded-full px-2 py-1.5 text-xs font-medium text-accent transition hover:bg-cream disabled:opacity-40"
            >
              В отпуск
            </button>
          </div>
        )}
      </td>
```

- [ ] **Step 4: Проверить в браузере**

`http://localhost:3000/admin` под LEAD-аккаунтом:
1. У сотрудника без отпуска — селекты + «В отпуск». Оформить «с текущей, 2 нед.». Expected: появился бейдж «🏖 с …», кнопка «Завершить досрочно»; на `/dashboard` сотрудник в «В отпуске».
2. Нажать «Завершить досрочно». Expected: бейдж пропал; идущий отпуск в БД получил `endDate` прошлой недели (или удалился, если начинался с текущей):

```bash
psql -d hiteam -c 'select "userId", "startDate", "endDate" from "Vacation";'
```

- [ ] **Step 5: Сборка и commit**

```bash
cd /Users/finogenovvladimir/hi-team && npm run build
git add app/admin/actions.ts app/admin/page.tsx components/AdminUserRow.tsx && git commit -m "feat: управление отпусками в админке «Команда»

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 9: AI-сводка и экспорт недели знают об отпусках

**Files:**
- Modify: `lib/summary.ts`
- Modify: `lib/openrouter.ts`
- Modify: `app/api/export/route.ts`

**Interfaces:**
- Consumes: `getVacationingUserIds` (Task 2).
- Produces: `WeekReportInput.vacationers?: string[]` в `lib/openrouter.ts`.

- [ ] **Step 1: lib/openrouter.ts — поле vacationers в промпте**

В тип `WeekReportInput` после `reports: [...]` добавить:

```ts
  /** Кто в отпуске на этой неделе — чтобы сводка не считала их «пропавшими». */
  vacationers?: string[];
```

В `buildUserPrompt` после цикла `for (const r of input.reports) {...}` (перед блоком `previousBlockers`) добавить:

```ts
  if (input.vacationers && input.vacationers.length > 0) {
    lines.push(
      `### В отпуске на этой неделе: ${input.vacationers.join(", ")}`,
      "Отчёт от них не ожидается — не упоминай их как отсутствующих или не сдавших.",
      "",
    );
  }
```

- [ ] **Step 2: lib/summary.ts — собрать имена отпускников**

Импорты:

```ts
import { getVacationingUserIds } from "@/lib/vacations";
```

После блока `previousBlockers` (перед `try {`) добавить:

```ts
  // Отпускники недели — контекст, чтобы сводка не записала их в «не сдавших».
  const vacationIds = await getVacationingUserIds(week.startDate);
  const vacationers =
    vacationIds.size > 0
      ? (
          await prisma.user.findMany({
            where: {
              id: { in: [...vacationIds] },
              active: true,
              role: { not: "DIRECTOR" },
            },
            select: { name: true, email: true },
            orderBy: { createdAt: "asc" },
          })
        ).map((u) => u.name ?? u.email)
      : [];
```

И передать в вызов:

```ts
    const { content, model } = await summarizeWeek({
      weekLabel: week.label,
      reports: week.reports.map((r) => ({
        name: r.user.name ?? r.user.email,
        projects: r.projects,
      })),
      previousBlockers,
      vacationers,
    });
```

- [ ] **Step 3: app/api/export/route.ts — строка «В отпуске» в экспорте**

Импорт:

```ts
import { getVacationingUserIds } from "@/lib/vacations";
```

Хелпер перед `const weekInclude = {`:

```ts
/** Имена отпускников недели для экспорта (активные, пишущие роли). */
async function vacationerNames(weekStart: Date): Promise<string[]> {
  const ids = await getVacationingUserIds(weekStart);
  if (ids.size === 0) return [];
  const users = await prisma.user.findMany({
    where: { id: { in: [...ids] }, active: true, role: { not: "DIRECTOR" } },
    select: { name: true, email: true },
    orderBy: { createdAt: "asc" },
  });
  return users.map((u) => u.name ?? u.email);
}
```

`weekMarkdown` — третий параметр и строка после сводки:

```ts
function weekMarkdown(
  week: WeekWithReports,
  heading: string,
  vacationers: string[] = [],
): string[] {
  const lines: string[] = [`${heading} Отчёты за неделю ${week.label}`, ""];

  if (week.summary) {
    lines.push(`${heading}# Сводка недели (AI)`, "", week.summary.content, "");
  }
  if (vacationers.length > 0) {
    lines.push(`**В отпуске:** ${vacationers.join(", ")}`, "");
  }
  // …дальше без изменений
```

`weekParagraphs` — аналогично:

```ts
function weekParagraphs(
  week: WeekWithReports,
  vacationers: string[] = [],
): Paragraph[] {
```

и после блока `if (week.summary) {...}`:

```ts
  if (vacationers.length > 0) {
    out.push(
      new Paragraph({
        children: [
          new TextRun({ text: "В отпуске: ", bold: true }),
          new TextRun(vacationers.join(", ")),
        ],
      }),
    );
  }
```

В `GET`, ветка `weekId` — получить имена и передать:

```ts
    const vacationers = await vacationerNames(week.startDate);
    const base = `week-${isoDate(week.startDate)}`;
    return docx
      ? docxResponse(weekParagraphs(week, vacationers), `${base}.docx`)
      : markdownResponse(weekMarkdown(week, "#", vacationers), `${base}.md`);
```

Ветка `month` — посчитать по всем неделям и передать по индексу:

```ts
    const vacByWeekList = await Promise.all(
      weeks.map((w) => vacationerNames(w.startDate)),
    );
```

в docx-ветке:

```ts
      weeks.forEach((w, i) => children.push(...weekParagraphs(w, vacByWeekList[i])));
```

(вместо `for (const w of weeks) children.push(...weekParagraphs(w));`)

в markdown-ветке:

```ts
    weeks.forEach((w, i) => {
      lines.push(...weekMarkdown(w, "##", vacByWeekList[i]));
    });
```

(вместо цикла `for (const w of weeks) { lines.push(...weekMarkdown(w, "##")); }`)

- [ ] **Step 4: Проверить экспорт**

Вставить тестовый отпуск на текущую неделю (Task 6 Step 3). В браузере на `/dashboard` скачать `.md` свежей недели (ссылка «Экспорт: .md») и проверить, что в файле есть строка `**В отпуске:** …`. AI-сводку вживую не проверяем (нет `OPENROUTER_API_KEY`) — для неё достаточно зелёной сборки. Удалить тестовую запись из `Vacation`.

- [ ] **Step 5: Сборка и commit**

```bash
cd /Users/finogenovvladimir/hi-team && npm run build
git add lib/summary.ts lib/openrouter.ts app/api/export/route.ts && git commit -m "feat: отпускники в AI-сводке и экспорте недели

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 10: Финальная проверка

**Files:** нет новых правок (только фиксы, если проверка что-то найдёт).

- [ ] **Step 1: Линт и сборка**

```bash
cd /Users/finogenovvladimir/hi-team && npm run lint && npm run build
```

Expected: оба зелёные.

- [ ] **Step 2: Сквозные сценарии в браузере (dev-сервер, аккаунт LEAD)**

1. `/report`: отметить отпуск «пока не вернусь», сохранить → в БД строка с `endDate = null`.
2. `/report`: сохранить отчёт заново (галочка автоматически стоит; снять её) → строка удалена.
3. `/admin`: оформить отпуск сотруднику Сотник Евгений «с текущей, 1 нед.» → `/dashboard`: он в «В отпуске», счётчик текущей недели уменьшил знаменатель, баннер без него.
4. `/analytics`: «Сдано на этой неделе: X из Y», Y меньше на 1.
5. Экспорт `.md` текущей недели содержит «**В отпуске:** Сотник Евгений».
6. `/admin`: «Завершить досрочно» → всё вернулось к исходному виду.
7. Автовозврат: оформить себе отпуск с текущей недели (psql, как в Task 6 Step 3), затем сохранить свой отчёт за текущую неделю → строка `Vacation` исчезла (отпуск начинался этой неделей — удалён целиком).

- [ ] **Step 3: Убрать тестовые данные**

```bash
psql -d hiteam -c 'select count(*) from "Vacation";'
```

Expected: остались только реально нужные записи (после сценариев — 0).

- [ ] **Step 4: Итоговый статус**

Сообщить пользователю результат всех сценариев и предложить варианты завершения ветки (merge в main / оставить ветку) — по скиллу superpowers:finishing-a-development-branch.

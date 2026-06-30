# hi-team — еженедельные отчёты команды

Веб-приложение для еженедельных отчётов команды вместо таблицы в Confluence.
Команда входит по **email + паролю**, заполняет отчёт в структуре
**Проект → Сделано / Блокеры / Планы**, а встроенный ИИ (OpenRouter) делает
сводку недели для руководителя.

## Стек

- **Next.js 16** (App Router, TypeScript) + **Tailwind CSS v4**
- **Auth.js (NextAuth v5)** — вход по email + паролю (Credentials, JWT, bcrypt)
- **Prisma + Neon Postgres**
- **OpenRouter** — AI-суммаризация (серверный route, ключ не уходит в браузер)
- Хостинг — **Vercel**

## Локальный запуск

1. Установить зависимости:
   ```bash
   npm install
   ```
2. Создать `.env` из примера и заполнить:
   ```bash
   cp .env.example .env
   ```
   - `DATABASE_URL` — строка подключения Neon (раздел **Connect**, pooled).
   - `AUTH_SECRET` — сгенерировать: `npx auth secret`.
   - `OPENROUTER_API_KEY` — **новый** ключ OpenRouter (старый отозвать!).
   - `ALLOWED_EMAILS` — почты команды через запятую.
3. Применить схему и засеять реальные данные из Confluence:
   ```bash
   npm run db:push
   npm run db:seed
   ```
4. Запустить:
   ```bash
   npm run dev
   ```
   Открыть http://localhost:3000. При первом входе нажмите **«Первый вход? Задать
   пароль»**, укажите почту из `ALLOWED_EMAILS` и задайте пароль — дальше вход по
   email + паролю.

## Структура

| Путь | Назначение |
| --- | --- |
| `app/login` | Вход по email + паролю (+ первый вход) |
| `app/dashboard` | Таблица недели × сотрудники + AI-сводка |
| `app/report` | Форма своего недельного отчёта |
| `app/api/summary` | Генерация AI-сводки недели (OpenRouter) |
| `lib/auth.ts` | Конфиг Auth.js (Credentials + allowlist) |
| `lib/openrouter.ts` | Вызов OpenRouter + промпт для руководителя |
| `lib/weeks.ts` | Текущая рабочая неделя и подписи дат |
| `prisma/schema.prisma` | Модель данных |
| `prisma/seed.ts` | Реальные отчёты команды (июнь 2026) |

## Деплой на Vercel

1. Запушить репозиторий на GitHub и импортировать в Vercel.
2. В **Settings → Environment Variables** добавить все переменные из `.env`
   (`APP_URL` — на адрес деплоя).
3. Применить схему к Neon один раз: локально с прод-`DATABASE_URL` выполнить
   `npm run db:push` и при необходимости `npm run db:seed`.
4. Deploy. Auth.js определит домен автоматически (`trustHost: true`).

## Безопасность

- `OPENROUTER_API_KEY` и прочие секреты — только в переменных окружения, не в коде
  и не в git (`.env*` в `.gitignore`). Все вызовы ИИ — на сервере.
- Ключ OpenRouter, отправленный в переписку при постановке задачи, считается
  скомпрометированным — **отзовите его и выпустите новый**.

## Дальше (заложено в архитектуре)

Нормализованные `Week / Report / ReportProject` позволяют добавить отслеживание
проектов со статусами, графики выполнения, фильтры, экспорт и авто-сводку по
расписанию (Vercel Cron).

// Авторизация cron-запросов: Vercel Cron шлёт заголовок
// Authorization: Bearer <CRON_SECRET>.

export function isAuthorizedCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // без секрета cron-роуты закрыты
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

// Мультитенант: помощники для определения команды (Workspace).

import { prisma } from "@/lib/db";

export const DEFAULT_WORKSPACE_SLUG = "main";

/** id команды по умолчанию (в неё сложены все данные до мультитенанта). */
export async function defaultWorkspaceId(): Promise<string | null> {
  const ws = await prisma.workspace.findUnique({
    where: { slug: DEFAULT_WORKSPACE_SLUG },
    select: { id: true },
  });
  return ws?.id ?? null;
}

/**
 * Команда, в которую попадёт пользователь с этой почтой при регистрации:
 * из его записи allowlist, иначе — команда по умолчанию.
 */
export async function workspaceIdForEmail(
  email: string,
): Promise<string | null> {
  const allowed = await prisma.allowedEmail.findUnique({
    where: { email: email.toLowerCase() },
    select: { workspaceId: true },
  });
  if (allowed?.workspaceId) return allowed.workspaceId;
  return defaultWorkspaceId();
}

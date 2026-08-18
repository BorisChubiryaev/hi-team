// Подкоманды (направления) — теперь на команду (таблица Subteam), а не enum.
// Каждая команда задаёт свой набор в супер-админке. Здесь — только хелперы
// отображения; сами подкоманды подгружаются из БД по workspaceId.

export type SubteamLite = { id: string; key: string; label: string };

/** Короткая подпись-хэштег для бейджа, напр. «#AI». */
export function subteamTag(key: string): string {
  return `#${key}`;
}

/**
 * Реестр тег-алиасов. Алиас (`@inputs`, `@actions` и т.д.) — это группа конкретных тегов,
 * которая разворачивается на стороне запроса в `pickByTags / omitByTags / matchByTags`.
 *
 * Семантика: алиас — это «зонтик». Запрос `pick(['@inputs'])` находит:
 *   1) элементы, у которых в meta.tags есть сам `@inputs`,
 *   2) элементы, у которых в meta.tags есть любой из его раскрытий (email, password, ...).
 *
 * Раскрытие рекурсивное (алиасы алиасов), с защитой от циклов.
 */

let aliases: Record<string, readonly string[]> = {
  // Минимальные дефолты. Разработчик может расширить через `registerAliases(...)`
  // или сбросить через `clearAliases()` + `registerAliases(...)`.
  '@inputs': ['email', 'password', 'phone', 'text', 'number'],
  '@actions': ['submit', 'cancel', 'reset'],
};

/** Слить переданные алиасы с текущим реестром (override по совпадающим ключам). */
export const registerAliases = (next: Record<string, readonly string[]>): void => {
  aliases = { ...aliases, ...next };
};

/** Полностью очистить реестр (включая дефолты). */
export const clearAliases = (): void => {
  aliases = {};
};

/** Снимок текущего реестра — read-only. */
export const getAliases = (): Readonly<Record<string, readonly string[]>> => aliases;

/**
 * Развернуть набор тегов с учётом алиасов. Возвращает «расширенный» набор:
 * исходные теги + все раскрытия + раскрытия раскрытий (рекурсивно).
 *
 * Защищает от циклов через множество посещённых.
 */
export const expandTags = (tags: readonly string[]): string[] => {
  const out = new Set<string>();
  const queue: string[] = [...tags];
  const seen = new Set<string>();

  while (queue.length > 0) {
    const tag = queue.shift() as string;
    if (seen.has(tag)) continue;
    seen.add(tag);
    out.add(tag);

    const expansion = aliases[tag];
    if (expansion) {
      for (const t of expansion) {
        if (!seen.has(t)) queue.push(t);
      }
    }
  }

  return [...out];
};

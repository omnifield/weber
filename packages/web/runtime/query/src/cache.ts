import type { QueryKey, QueryState } from './types';

interface CacheEntry<T = unknown> {
  key: QueryKey;
  state: QueryState<T>;
  /** Текущий in-flight Promise, для dedupe параллельных fetch'ей. */
  inFlight: Promise<T> | null;
}

/**
 * Stable JSON.stringify — сортирует ключи объектов рекурсивно, чтобы
 * `{a:1,b:2}` и `{b:2,a:1}` давали одинаковую сериализацию.
 *
 * Без этого cache-key зависел от порядка полей в input'е, что приводило к
 * silent cache-miss'ам, если разные места кода собирали объект с разным
 * порядком полей. После zod-parse порядок детерминирован, но прямые вызовы
 * `client.fetch(['users', input])` это не гарантировали.
 *
 * Массивы — order-sensitive (это намеренно: `['a','b'] !== ['b','a']`).
 * Примитивы / Date / null / undefined обрабатываются стандартно.
 */
const stableStringify = (value: unknown): string => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  // Plain object: сортируем ключи, рекурсивно сериализуем.
  const keys = Object.keys(value as Record<string, unknown>).sort();
  const parts = keys.map(
    (k) => `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`,
  );
  return `{${parts.join(',')}}`;
};

const serializeKey = (key: QueryKey): string => stableStringify(key);

/**
 * Проверка: `key` начинается с `prefix`. Используется для префиксной инвалидации:
 * `invalidate(['users'])` бьёт `['users', 'page', 1]`, `['users', filterX]` и т.д.
 */
const isPrefix = (key: QueryKey, prefix: QueryKey): boolean => {
  if (prefix.length > key.length) return false;
  for (let i = 0; i < prefix.length; i++) {
    if (serializeKey([key[i]]) !== serializeKey([prefix[i]])) return false;
  }
  return true;
};

/** Map-кэш с сериализованным JSON-ключом. */
export class QueryCache {
  private map = new Map<string, CacheEntry>();

  get<T = unknown>(key: QueryKey): CacheEntry<T> | undefined {
    return this.map.get(serializeKey(key)) as CacheEntry<T> | undefined;
  }

  set<T>(key: QueryKey, entry: CacheEntry<T>): void {
    this.map.set(serializeKey(key), entry as CacheEntry);
  }

  delete(key: QueryKey): void {
    this.map.delete(serializeKey(key));
  }

  /** Префиксная инвалидация — отмечает все matched entries как stale (`fetchedAt = 0`). */
  invalidate(prefix: QueryKey): void {
    for (const entry of this.map.values()) {
      if (isPrefix(entry.key, prefix)) entry.state.fetchedAt = 0;
    }
  }

  clear(): void {
    this.map.clear();
  }
}

/** Для использования в client.ts при формировании syncTo-ключа ошибок. */
export const keyToString = serializeKey;

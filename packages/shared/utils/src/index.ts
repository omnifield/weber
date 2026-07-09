/**
 * @omnifield/shared-utils — curated утилитарный surface для app-логики.
 *
 * Экспортирует единый namespace `Utils`, который инжектится как глобал через
 * unplugin-auto-import (аналогично `Zod` из @omnifield/shared-zod).
 *
 * Состав:
 *  - вся es-toolkit (spread) — chunk, groupBy, uniq, omit, pick, merge,
 *    cloneDeep, debounce, isEqual, clamp, sum, camelCase, delay и др.
 *  - gap-филлеры: функциональные обёртки над нативными Array/Object методами,
 *    которые es-toolkit намеренно не дублирует.
 *
 * App-код вызывает `Utils.map(arr, fn)`, `Utils.groupBy(arr, key)` и т.д.
 * Ни один нативный метод (.map / .filter / Object.keys) в app-коде напрямую
 * не используется — всё через `Utils`.
 */
import * as esToolkit from 'es-toolkit';

// ---------------------------------------------------------------------------
// Gap-филлеры — Array
// ---------------------------------------------------------------------------

/** Функциональная обёртка над Array.prototype.map. */
export const map = <T, R>(coll: readonly T[], fn: (item: T, i: number) => R): R[] => coll.map(fn);

/** Функциональная обёртка над Array.prototype.filter. */
export const filter = <T>(coll: readonly T[], predicate: (item: T, i: number) => boolean): T[] =>
  coll.filter(predicate);

/** Функциональная обёртка над Array.prototype.find. */
export const find = <T>(
  coll: readonly T[],
  predicate: (item: T, i: number) => boolean,
): T | undefined => coll.find(predicate);

/** Функциональная обёртка над Array.prototype.findIndex. */
export const findIndex = <T>(
  coll: readonly T[],
  predicate: (item: T, i: number) => boolean,
): number => coll.findIndex(predicate);

/** Функциональная обёртка над Array.prototype.reduce. */
export const reduce = <T, R>(
  coll: readonly T[],
  fn: (acc: R, item: T, i: number) => R,
  initial: R,
): R => coll.reduce(fn, initial);

/** Функциональная обёртка над Array.prototype.forEach. */
export const forEach = <T>(coll: readonly T[], fn: (item: T, i: number) => void): void =>
  coll.forEach(fn);

/** Функциональная обёртка над Array.prototype.some. */
export const some = <T>(coll: readonly T[], predicate: (item: T, i: number) => boolean): boolean =>
  coll.some(predicate);

/** Функциональная обёртка над Array.prototype.every. */
export const every = <T>(coll: readonly T[], predicate: (item: T, i: number) => boolean): boolean =>
  coll.every(predicate);

/** Функциональная обёртка над Array.prototype.includes. */
export const includes = <T>(coll: readonly T[], item: T, fromIndex?: number): boolean =>
  coll.includes(item, fromIndex);

/** Возвращает отсортированную копию массива (не мутирует оригинал). */
export const sort = <T>(coll: readonly T[], compareFn?: (a: T, b: T) => number): T[] =>
  [...coll].sort(compareFn);

/** Возвращает реверсированную копию массива (не мутирует оригинал). */
export const reverse = <T>(coll: readonly T[]): T[] => [...coll].reverse();

/** Функциональная обёртка над Array.prototype.concat. */
export const concat = <T>(...arrays: ReadonlyArray<readonly T[]>): T[] =>
  ([] as T[]).concat(...(arrays as T[][]));

/** Функциональная обёртка над Array.prototype.slice. */
export const slice = <T>(coll: readonly T[], start?: number, end?: number): T[] =>
  coll.slice(start, end);

/** Функциональная обёртка над Array.prototype.join. */
export const join = <T>(coll: readonly T[], separator?: string): string => coll.join(separator);

// ---------------------------------------------------------------------------
// Gap-филлеры — Object
// ---------------------------------------------------------------------------

/** Функциональная обёртка над Object.keys. */
export const keys = <T extends object>(obj: T): (keyof T & string)[] =>
  Object.keys(obj) as (keyof T & string)[];

/** Функциональная обёртка над Object.values. */
export const values = <T extends object>(obj: T): T[keyof T][] =>
  Object.values(obj) as T[keyof T][];

/** Функциональная обёртка над Object.entries. */
export const entries = <T extends object>(obj: T): [keyof T & string, T[keyof T]][] =>
  Object.entries(obj) as [keyof T & string, T[keyof T]][];

/** Функциональная обёртка над Object.fromEntries. */
export const fromEntries = <K extends string, V>(pairs: Iterable<readonly [K, V]>): Record<K, V> =>
  Object.fromEntries(pairs) as Record<K, V>;

/** Проверяет наличие собственного (non-inherited) ключа. Обёртка над Object.hasOwn. */
export const hasKey = <T extends object>(obj: T, key: PropertyKey): key is keyof T =>
  Object.hasOwn(obj, key);

// ---------------------------------------------------------------------------
// Итоговый namespace Utils
// ---------------------------------------------------------------------------

/**
 * Curated utility surface для app-логики (Controllers, Features).
 *
 * Инжектируется как глобал `Utils` через unplugin-auto-import.
 * App-код никогда не использует нативные методы напрямую — только `Utils.X(...)`.
 *
 * Базис: вся es-toolkit (1.46.x) плюс gap-филлеры для тривиальных нативных операций,
 * которые es-toolkit намеренно не реэкспортирует.
 *
 * При коллизии имён (если es-toolkit добавит функцию с тем же именем в будущем):
 * es-toolkit имеет приоритет (spread es-toolkit идёт последним, перекрывает gap-филлеры).
 * Для контроля приоритета см. порядок спреда ниже — gap-филлеры первыми,
 * esToolkit поверх (чтобы будущие es-toolkit реализации автоматически вытесняли gap).
 */
export const Utils = {
  // Gap-филлеры (Array)
  map,
  filter,
  find,
  findIndex,
  reduce,
  forEach,
  some,
  every,
  includes,
  sort,
  reverse,
  concat,
  slice,
  join,
  // Gap-филлеры (Object)
  keys,
  values,
  entries,
  fromEntries,
  hasKey,
  // es-toolkit (перекрывает gap при коллизии)
  ...esToolkit,
} as const;

export default Utils;

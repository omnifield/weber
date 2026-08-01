/**
 * Path-tracker — Proxy, запоминающий цепочку property-access'ов
 * (порт капсульного shape/ui-tracker.ts 1:1, symbol переименован).
 *
 * Shape-фабрика вызывается на import (real proxied Ui ещё не существует):
 * `ui.Navigation.Item` возвращает объект с захваченным путём; на рендере
 * Shape резолвит путь по реальному Ui из ShapeUiContext.
 */

const PATH = Symbol.for('@omnifield/weber-engine:shape-ui-path');

type Tracker = ((..._: unknown[]) => unknown) & {
  readonly [PATH]: readonly string[];
  readonly [key: string]: Tracker;
};

export const createUiTracker = (path: readonly string[] = []): Tracker => {
  const target = (() => undefined) as unknown as Tracker;
  return new Proxy(target, {
    get(_, key) {
      if (key === PATH) return path;
      if (typeof key === 'symbol') return undefined;
      return createUiTracker([...path, key]);
    },
  }) as Tracker;
};

/** Путь tracker'а или `undefined`, если это не tracker. */
export const getTrackerPath = (x: unknown): readonly string[] | undefined => {
  if (typeof x !== 'function' && (typeof x !== 'object' || x === null)) return undefined;
  const p = (x as Record<symbol, unknown>)[PATH];
  return Array.isArray(p) ? (p as readonly string[]) : undefined;
};

/** Walks `root` по `path` — `root.a.b.c`. */
export const resolveByPath = (root: unknown, path: readonly string[]): unknown => {
  let cur: unknown = root;
  for (const seg of path) {
    if (cur == null) return undefined;
    cur = (cur as Record<string, unknown>)[seg];
  }
  return cur;
};

/**
 * Резолв одного значения: tracker → по пути; функция → обёртка с рекурсивным
 * резолвом объектов-результатов; остальное pass-through. Глубокая рекурсия по
 * plain-объектам намеренно НЕ делается (защита defaults/data-структур).
 */
export const resolveValue = (value: unknown, realUi: unknown): unknown => {
  if (value === null || value === undefined) return value;

  const path = getTrackerPath(value);
  if (path !== undefined) {
    if (realUi) return resolveByPath(realUi, path);
    return value;
  }

  if (typeof value === 'function') {
    const fn = value as (...args: unknown[]) => unknown;
    return (...args: unknown[]) => {
      const result = fn(...args);
      if (result !== null && typeof result === 'object' && !Array.isArray(result)) {
        return resolveValuesInObject(result as Record<string, unknown>, realUi);
      }
      return result;
    };
  }

  return value;
};

/** Shallow-резолв всех значений объекта через resolveValue. */
export const resolveValuesInObject = (
  obj: Record<string, unknown>,
  realUi: unknown,
): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(obj)) {
    out[key] = resolveValue(obj[key], realUi);
  }
  return out;
};

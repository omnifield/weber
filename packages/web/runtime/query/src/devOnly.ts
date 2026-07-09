/**
 * Обёртка над значением (например, `preRequest`-хэндлером), которая в prod-
 * сборке Vite/Rollup tree-shake'ается в ничто.
 *
 * - **Vite dev:** `import.meta.env.DEV === true` → возвращается `value`.
 * - **Vite prod build:** `import.meta.env.DEV === false` (inline-replace
 *   константы) → ветка `env.DEV === false` constant-fold'ится в `true`,
 *   функция возвращает `undefined`, а `value` становится dead code →
 *   Rollup DCE удаляет его из bundle.
 * - **Node / unit-test env** где `import.meta.env` отсутствует — возвращается
 *   `value` (трактуем как dev).
 *
 * ```ts
 * preRequest: devOnly(({ resolve }) => resolve({ token: 'mock' })),
 * ```
 *
 * Важно: проверку `import.meta.env.DEV` НЕ оборачиваем в helper-функцию —
 * любая обёртка может пресечь tree-shake (Rollup перестаёт видеть, что
 * условие — константа). Inline-тернарник внутри `devOnly` остаётся в bundle,
 * но это байты, а не сам hooks-payload.
 */
export const devOnly = <T>(value: T): T | undefined => {
  const env = typeof import.meta !== 'undefined' ? (import.meta as any).env : undefined;
  if (env && env.DEV === false) return undefined;
  return value;
};

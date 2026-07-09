import { describe, expect, it } from 'vitest';
import { devOnly } from '../devOnly';

// `devOnly` использует `import.meta.env.DEV` для tree-shake'а в prod-build'е.
// Vite/Rollup конст-фолдят это выражение AT BUILD TIME — то есть в скомпилированном
// prod-bundle `env.DEV === false` становится литералом `true` (для prod) или
// `false` (для dev). В test-окружении Vitest при transformе подставляет
// `DEV === true` → наш guard `if (env && env.DEV === false)` всегда `false` →
// возвращается value as-is.
//
// Из-за этого "верифицировать prod-ветку" runtime-мутацией `import.meta.env.DEV`
// невозможно (Vitest конст-фолдит ту же подстановку раньше). Проверяем то, что
// реально работает в test-env:
//   - dev-passthrough (по умолчанию);
//   - undefined-env fallback (когда `import.meta.env` отсутствует — Node-ESM).
//
// Поведение prod-tree-shake верифицируется на уровне реальной Vite-сборки apps,
// не в unit-тестах.

describe('devOnly', () => {
  it('passthrough в dev-env (default Vitest, import.meta.env.DEV === true)', () => {
    const handler = () => 42;
    expect(devOnly(handler)).toBe(handler);
  });

  it('passthrough для объектов и null-значений (не только функций)', () => {
    expect(devOnly({ mocked: true })).toEqual({ mocked: true });
    expect(devOnly(null)).toBeNull();
    expect(devOnly(0)).toBe(0);
  });

  it('passthrough когда import.meta.env отсутствует (Node-fallback)', () => {
    const originalEnv = (import.meta as any).env;
    try {
      (import.meta as any).env = undefined;
      const handler = () => 42;
      expect(devOnly(handler)).toBe(handler);
    } finally {
      (import.meta as any).env = originalEnv;
    }
  });
});

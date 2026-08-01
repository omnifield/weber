import { resolve } from 'node:path';
import solid from 'vite-plugin-solid';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Плагин нужен не ради JSX, а ради РЕЗОЛВА: без него vitest берёт
  // solid-js/dist/server.js (SSR, реактивность no-op) — conformance-тесты
  // реактивности молча мертвы. Плагин выставляет browser/solid-conditions.
  plugins: [solid({ hot: false })],
  resolve: {
    alias: {
      '@omnifield/weber-kernel': resolve(__dirname, '../../core/kernel/src/index.ts'),
    },
    dedupe: ['solid-js', 'solid-js/store'],
  },
  test: {
    include: ['src/**/__tests__/**/*.test.ts'],
    // JSX не нужен: реактивность Solid тестируется через createRoot/createComputed.
    environment: 'node',
    globals: false,
    server: {
      deps: {
        // solid-js внешним резолвится НОДОЙ (node-condition → dist/server.js,
        // SSR no-op реактивность). Инлайн гонит его через vite-резолв с
        // browser-conditions выше — живая реактивность в тестах.
        inline: [/solid-js/],
      },
    },
  },
});

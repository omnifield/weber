import { resolve } from 'node:path';
import solid from 'vite-plugin-solid';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // hot:false — solid-refresh в jsdom-тестах ломается на file:/// URL.
  plugins: [solid({ hot: false })],
  resolve: {
    alias: {
      // workspace-dep напрямую в src: тесты не зависят от собранного dist
      // (и от порядка nx build), Vite транформирует kernel как обычный модуль.
      '@omnifield/weber-kernel': resolve(__dirname, '../kernel/src/index.ts'),
    },
    dedupe: ['solid-js', 'solid-js/web', 'solid-js/store'],
  },
  test: {
    include: ['src/**/__tests__/**/*.test.ts', 'src/**/__tests__/**/*.test.tsx'],
    environment: 'jsdom',
    globals: false,
  },
});

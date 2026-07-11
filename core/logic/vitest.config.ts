import { resolve } from 'node:path';
import solid from 'vite-plugin-solid';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [solid({ hot: false })],
  resolve: {
    alias: {
      '@weber/kernel': resolve(__dirname, '../kernel/src/index.ts'),
    },
    dedupe: ['solid-js', 'solid-js/web', 'solid-js/store'],
  },
  test: {
    include: ['src/**/__tests__/**/*.test.ts', 'src/**/__tests__/**/*.test.tsx'],
    environment: 'jsdom',
    globals: false,
  },
});

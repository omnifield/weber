import solid from 'vite-plugin-solid';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Плагин ради резолва solid (SSR-грабля из OWNERSHIP @weber/state).
  plugins: [solid({ hot: false })],
  resolve: {
    dedupe: ['solid-js'],
  },
  test: {
    include: ['src/**/__tests__/**/*.test.ts', 'src/**/__tests__/**/*.test.tsx'],
    environment: 'jsdom',
    globals: false,
  },
});

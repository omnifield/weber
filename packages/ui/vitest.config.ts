import { resolve } from 'node:path';
import solid from 'vite-plugin-solid';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [solid({ hot: false })],
  resolve: {
    alias: {
      '@weber/style': resolve(__dirname, '../style/src/index.ts'),
    },
    dedupe: ['solid-js', 'solid-js/web'],
  },
  test: {
    include: ['src/**/__tests__/**/*.test.ts', 'src/**/__tests__/**/*.test.tsx'],
    environment: 'jsdom',
    globals: false,
    server: {
      // kobalte шипит .jsx в dist — vite обязан транформировать (грабля предка).
      deps: { inline: [/@kobalte\/core/, /solid-prevent-scroll/, /solid-presence/] },
    },
  },
});

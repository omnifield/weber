import solid from 'vite-plugin-solid';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // hot:false — solid-refresh в jsdom-тестах ломается на file:/// URL.
  plugins: [solid({ hot: false })],
  resolve: {
    dedupe: ['solid-js', 'solid-js/web', 'solid-js/store'],
  },
  test: {
    include: ['src/**/__tests__/**/*.test.ts', 'src/**/__tests__/**/*.test.tsx'],
    // jsdom — для context-тестов (render + Provider).
    environment: 'jsdom',
    globals: false,
  },
});

import solid from 'vite-plugin-solid';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [solid({ hot: false }), tsconfigPaths({ root: '../../..' })],
  test: {
    include: ['src/**/__tests__/**/*.test.ts', 'src/**/__tests__/**/*.test.tsx'],
    environment: 'jsdom',
    globals: false,
    // vite-plugin-solid auto-injects '@testing-library/jest-dom/vitest' as a setupFile
    // when it detects the package is resolvable (it is, via workspace hoisting). Explicitly
    // listing it here satisfies the plugin's guard so it does not double-inject, and ensures
    // it resolves in this package's context.
    setupFiles: ['@testing-library/jest-dom/vitest'],
  },
});

import { defineWeberApp } from '@weber/vite';

export default defineWeberApp({
  // Single-origin канон: полигон живёт за gateway :8080 → /sandbox/.
  override: { base: '/sandbox/' },
});

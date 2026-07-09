import { type Accessor, createSignal } from 'solid-js';

const STORAGE_KEY = 'omnifield-resize-mode';

// Module-level singleton signal. SSR-safe: localStorage read guarded.
// Default: true — resize is enabled by default (no prior stored value → on).
const [enabled, setEnabled] = createSignal<boolean>(
  typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) !== 'false' : true,
);

/**
 * Reactive accessor for resizeMode. Solid tracks reads automatically
 * in createMemo / JSX. Signal initialised once on module-load from
 * localStorage (browser-only guard). Changes via `setResizeMode(...)`.
 *
 * Default: `true` (resize globally enabled). A stored value of `'false'`
 * is the only falsy state — anything else (missing key, `'true'`) → `true`.
 *
 * Storage key: `omnifield-resize-mode`.
 */
export const useResizeMode = (): Accessor<boolean> => enabled;

/** Set + persist. */
export const setResizeMode = (next: boolean): void => {
  setEnabled(next);
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, String(next));
  }
};

/** Toggle helper — `false` ⇔ `true`. */
export const toggleResizeMode = (): void => {
  setResizeMode(!enabled());
};

import { type Accessor, createSignal } from 'solid-js';

const STORAGE_KEY = 'omnifield-dnd-mode';

// Module-level singleton signal. SSR-safe: localStorage read guarded.
// Default: true — drag-and-drop is enabled by default (no prior stored value → on).
const [enabled, setEnabled] = createSignal<boolean>(
  typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) !== 'false' : true,
);

/**
 * Reactive accessor for dndMode. Controls whether drag-and-drop is globally
 * enabled in the Matrix layout. This is orthogonal to `resizeMode` — both
 * can be toggled independently.
 *
 * NOTE: this signal is about the global dnd on/off toggle, NOT about the
 * swap/insert kind — that remains a Matrix prop in `@omnifield/web-ui`.
 *
 * Default: `true` (dnd globally enabled). A stored value of `'false'` is the
 * only falsy state — anything else (missing key, `'true'`) → `true`.
 *
 * Storage key: `omnifield-dnd-mode`.
 */
export const useDndMode = (): Accessor<boolean> => enabled;

/** Set + persist. */
export const setDndMode = (next: boolean): void => {
  setEnabled(next);
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, String(next));
  }
};

/** Toggle helper — `false` ⇔ `true`. */
export const toggleDndMode = (): void => {
  setDndMode(!enabled());
};

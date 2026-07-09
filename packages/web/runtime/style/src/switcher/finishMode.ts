import { type Accessor, createSignal } from 'solid-js';

const STORAGE_KEY = 'omnifield-finish-mode';

/**
 * Apply (or remove) the `data-finish` attribute on the target element.
 * When present, `createFinish` in `@omnifield/web-ui` activates the
 * gradient-surface / hairline / depth treatment on all surface primitives
 * that descend from the element (typically `document.documentElement`).
 *
 * SSR-safe: no-op when `typeof window === 'undefined'`.
 */
export const applyFinishMode = (on: boolean, target?: HTMLElement): void => {
  if (typeof window === 'undefined') return;
  const el = target ?? document.documentElement;
  if (on) {
    el.setAttribute('data-finish', '');
  } else {
    el.removeAttribute('data-finish');
  }
};

// Module-level singleton signal. SSR-safe: localStorage read guarded.
// Default: false — finish is OFF by default (zero regression for existing apps).
// A stored value of 'true' is the only truthy state — anything else → false.
const [enabled, setEnabled] = createSignal<boolean>(
  typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) === 'true' : false,
);

// Apply initial value immediately on module-load (browser only).
if (typeof window !== 'undefined') {
  applyFinishMode(enabled());
}

/**
 * Reactive accessor for finishMode. Solid tracks reads automatically
 * in createMemo / JSX. Signal initialised once on module-load from
 * localStorage (browser-only guard). Changes via `setFinishMode(...)`.
 *
 * finishMode controls the `data-finish` attribute on `<html>`. When set,
 * surface primitives in `@omnifield/web-ui` render with gradient,
 * hairline, and depth effects via `createFinish`.
 *
 * Default: `false` (finish globally disabled). A stored value of `'true'`
 * is the only truthy state — anything else (missing key, `'false'`) → `false`.
 *
 * Storage key: `omnifield-finish-mode`.
 */
export const useFinishMode = (): Accessor<boolean> => enabled;

/**
 * Set finishMode, apply `data-finish` attribute to DOM, persist to localStorage.
 *
 * @param next  - `true` to enable finish effects, `false` to disable.
 * @param target - Optional override element; defaults to `document.documentElement`.
 */
export const setFinishMode = (next: boolean, target?: HTMLElement): void => {
  setEnabled(next);
  applyFinishMode(next, target);
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, String(next));
  }
};

/**
 * Toggle finishMode — `false` ⇔ `true`.
 *
 * @param target - Optional override element; defaults to `document.documentElement`.
 */
export const toggleFinishMode = (target?: HTMLElement): void => {
  setFinishMode(!enabled(), target);
};

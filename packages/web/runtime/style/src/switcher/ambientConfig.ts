import { type Accessor, createSignal } from 'solid-js';

const STORAGE_KEY = 'omnifield-ambient-config';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * A single radial glow blob in the ambient background layer.
 *
 * Coordinates are in viewport-percentage units so they work at any viewport
 * size without magic numbers. Values outside 0-100 are valid — they place the
 * glow centre beyond the viewport edge, creating a partial off-screen bloom.
 */
export interface IAmbientGlow {
  /** Horizontal position of the glow centre (%). May be <0 or >100. */
  x: number;
  /** Vertical position of the glow centre (%). May be <0 or >100. */
  y: number;
  /**
   * Radius of the glow as a percentage of the viewport.
   * A single-value radial-gradient percentage is invalid CSS, so this value
   * is always rendered as `size% size%` (equal horizontal / vertical radii).
   * Values >100 are valid — they create a glow larger than the viewport.
   */
  size: number;
  /** Brightness / mix-strength of the glow. 0 = invisible, 1 = full colour. */
  alpha: number;
  /**
   * Which theme token to mix the glow from.
   *
   * Inline gradients use raw theme vars (`--primary` / `--accent`), not Tailwind
   * `--color-*` (utility-only, not guaranteed on :root). Raw vars are always
   * emitted by `[data-theme]` so no fallback is required.
   *
   * `'primary'` → `var(--primary)`.
   * `'accent'`  → `var(--accent)`.
   */
  tint: 'primary' | 'accent';
}

/** Full ambient-background configuration — an ordered list of glow blobs. */
export interface IAmbientConfig {
  glows: IAmbientGlow[];
}

// ─── Default preset ───────────────────────────────────────────────────────────

/**
 * Three-glow preset that mirrors the hard-coded radial-gradients previously
 * defined in `index.css`. Each entry has been calibrated to reproduce the
 * same visual result through the dynamic `--app-ambient` CSS variable.
 *
 * Positions intentionally exceed 0-100 to push glow centres off-screen,
 * creating partial bloom effects at viewport edges (matching the old CSS).
 */
export const DEFAULT_AMBIENT_CONFIG: IAmbientConfig = {
  glows: [
    { x: 8, y: -6, size: 55, alpha: 0.28, tint: 'primary' },
    { x: 112, y: 116, size: 50, alpha: 0.22, tint: 'primary' },
    { x: 96, y: 4, size: 42, alpha: 0.14, tint: 'accent' },
  ],
};

/** Default values for a newly added glow (before any caller patch is applied). */
const GLOW_DEFAULTS: IAmbientGlow = {
  x: 50,
  y: 50,
  size: 40,
  alpha: 0.15,
  tint: 'primary',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Read and merge a persisted JSON value over `DEFAULT_AMBIENT_CONFIG`. SSR-safe. */
function readStorage(): IAmbientConfig {
  if (typeof window === 'undefined') return DEFAULT_AMBIENT_CONFIG;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_AMBIENT_CONFIG;
    const parsed = JSON.parse(raw) as Partial<IAmbientConfig>;
    // Merge at the config level; if glows array is present use it directly,
    // otherwise fall back to the default array.
    return {
      ...DEFAULT_AMBIENT_CONFIG,
      ...(parsed.glows !== undefined ? { glows: parsed.glows } : {}),
    };
  } catch {
    return DEFAULT_AMBIENT_CONFIG;
  }
}

/** Persist the full config to localStorage. SSR-safe. */
function writeStorage(value: IAmbientConfig): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Quota exceeded or private-mode — silently ignore.
  }
}

/**
 * Build and apply the `--app-ambient` CSS custom property on
 * `document.documentElement` from the current list of glows.
 *
 * Each glow becomes:
 *   radial-gradient(size% size% at x% y%, color-mix(in srgb, var(--color-<tint>) alpha%, transparent) 0%, transparent 70%)
 *
 * Note: `size% size%` (two values) is required — a single percentage is
 * invalid in `radial-gradient()`.
 *
 * SSR-safe: no-op when `typeof window === 'undefined'`.
 */
export function applyAmbient(cfg: IAmbientConfig): void {
  if (typeof window === 'undefined') return;

  const { glows } = cfg;

  if (glows.length === 0) {
    document.documentElement.style.setProperty('--app-ambient', 'none');
    return;
  }

  const parts = glows.map(({ x, y, size, alpha, tint }) => {
    const mixPct = Math.round(alpha * 100);
    // Raw theme variable — always emitted by `[data-theme]` regardless of
    // Tailwind `@theme inline` mapping. No fallback needed.
    const colorToken = `var(--${tint})`;
    return (
      `radial-gradient(${size}% ${size}% at ${x}% ${y}%, ` +
      `color-mix(in srgb, ${colorToken} ${mixPct}%, transparent) 0%, transparent 70%)`
    );
  });

  document.documentElement.style.setProperty('--app-ambient', parts.join(', '));
}

// ─── Module-level singleton signal ────────────────────────────────────────────

const [config, setConfig] = createSignal<IAmbientConfig>(readStorage());

// Apply the initial value immediately on module-load (browser-only).
applyAmbient(config());

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Reactive accessor for the ambient-background configuration.
 *
 * Solid tracks reads inside `createMemo` / JSX automatically.
 * The signal is initialised once on module-load from `localStorage`
 * (browser-only guard). New fields are always back-filled with
 * `DEFAULT_AMBIENT_CONFIG` so additions are non-breaking.
 *
 * Storage key: `omnifield-ambient-config` (JSON).
 */
export const useAmbientConfig = (): Accessor<IAmbientConfig> => config;

/**
 * Patch a single glow at the given index.
 *
 * Only the supplied keys are changed; all other keys in that glow keep their
 * current values. After patching the signal is updated, `--app-ambient` is
 * re-applied, and the result is persisted.
 *
 * @param index - 0-based index into `config().glows`. Out-of-range → no-op.
 * @param patch - Partial glow to merge into the existing entry.
 */
export const setAmbientGlow = (index: number, patch: Partial<IAmbientGlow>): void => {
  const current = config();
  if (index < 0 || index >= current.glows.length) return;

  const next: IAmbientConfig = {
    glows: current.glows.map((g, i) => (i === index ? { ...g, ...patch } : g)),
  };
  setConfig(next);
  applyAmbient(next);
  writeStorage(next);
};

/**
 * Append a new glow to the list.
 *
 * The new glow is built from the internal defaults and then overridden by
 * the optional `glow` patch, so callers can supply only the fields they care about.
 *
 * @param glow - Optional partial override applied on top of the built-in defaults.
 */
export const addAmbientGlow = (glow?: Partial<IAmbientGlow>): void => {
  const newGlow: IAmbientGlow = { ...GLOW_DEFAULTS, ...glow };
  const next: IAmbientConfig = {
    glows: [...config().glows, newGlow],
  };
  setConfig(next);
  applyAmbient(next);
  writeStorage(next);
};

/**
 * Remove the glow at the given index.
 *
 * Out-of-range index is silently ignored. After removal `--app-ambient` is
 * re-applied (possibly to `'none'` when the list becomes empty).
 *
 * @param index - 0-based index into `config().glows`.
 */
export const removeAmbientGlow = (index: number): void => {
  const current = config();
  if (index < 0 || index >= current.glows.length) return;

  const next: IAmbientConfig = {
    glows: current.glows.filter((_, i) => i !== index),
  };
  setConfig(next);
  applyAmbient(next);
  writeStorage(next);
};

/**
 * Reset all glows to `DEFAULT_AMBIENT_CONFIG`, re-apply `--app-ambient`,
 * and remove the `localStorage` entry so the next module-load also returns defaults.
 */
export const resetAmbientConfig = (): void => {
  setConfig(DEFAULT_AMBIENT_CONFIG);
  applyAmbient(DEFAULT_AMBIENT_CONFIG);
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Silently ignore.
    }
  }
};

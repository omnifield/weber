import { type Accessor, createSignal } from 'solid-js';

const STORAGE_KEY = 'omnifield-finish-config';

// ─── Canonical type ────────────────────────────────────────────────────────────

/**
 * Tunable parameters for the finish effect.
 *
 * This is the **canonical** definition — `@omnifield/web-ui` imports from here
 * to stay cycle-free (web-ui depends on web-style, never the other way around).
 *
 * Token references (CSS custom properties from `@omnifield/web-style` themes):
 *   --color-card       — surface base colour
 *   --color-foreground — primary text (used at low alpha for highlight tint)
 *   --color-primary    — accent colour (used at low alpha to add tint on bottom)
 */
export interface IFinishConfig {
  // ── Surface gradient (linear 180deg, 3 stops) ────────────────────────────────

  /** Alpha of the foreground tint at the top gradient stop. Default: 0.09 */
  topForegroundAlpha: number;

  /** Position (%) of the top gradient stop. Default: 0 */
  topStopPosition: number;

  /** Card opacity at the mid gradient stop. Default: 0.70 */
  midCardAlpha: number;

  /** Position (%) of the mid gradient stop. Default: 45 */
  midStopPosition: number;

  /** Alpha of the primary-colour tint at the bottom gradient stop. Default: 0.18 */
  bottomPrimaryAlpha: number;

  /** Position (%) of the bottom gradient stop. Default: 100 */
  bottomStopPosition: number;

  // ── Insets ───────────────────────────────────────────────────────────────────

  /** Alpha of the top 1-px hairline inset shadow (foreground colour). Default: 0.40 */
  hairlineAlpha: number;

  /** Alpha of the thin full-outline inner-border inset shadow. Default: 0.06 */
  innerBorderAlpha: number;

  /**
   * Alpha of the soft radial inset glow (primary colour, centred on the surface).
   * Rendered as an additional `inset` box-shadow layer that gives a subtle
   * "inner bloom" — complementary to `glowAlpha` which is an outer depth shadow.
   * 0 = disabled (no visual change vs previous versions).
   * Default: 0
   */
  innerGlowAlpha: number;

  // ── Outer depth ──────────────────────────────────────────────────────────────

  /** CSS value for the tight contact shadow. Default: '0 1px 2px rgb(0 0 0 / 0.4)' */
  contactShadow: string;

  /** Alpha of the coloured depth glow (primary colour). Default: 0.22 */
  glowAlpha: number;

  /** Offset-x / offset-y / blur for the depth glow. Default: '0 8px 24px' */
  glowSpread: string;

  // ── New knobs ────────────────────────────────────────────────────────────────

  /**
   * When `true`, outer shadows (contactShadow + glow) are suppressed;
   * only inset highlights remain.
   * Default: false
   */
  innerOnly: boolean;

  /**
   * Alpha of a radial primary-tint glow centred on the surface.
   * 0 = disabled.
   * Default: 0
   */
  centerGlowAlpha: number;

  /** Radius of the centre glow (CSS size value). Default: '60%' */
  centerGlowSize: string;

  /**
   * Overall surface opacity. Values < 1 create a translucent surface.
   * Default: 1
   */
  surfaceAlpha: number;
}

// ─── Defaults (approved preset) ───────────────────────────────────────────────

export const DEFAULT_FINISH_CONFIG: IFinishConfig = {
  topForegroundAlpha: 0.09,
  topStopPosition: 0,
  midCardAlpha: 0.7,
  midStopPosition: 45,
  bottomPrimaryAlpha: 0.18,
  bottomStopPosition: 100,
  hairlineAlpha: 0.4,
  innerBorderAlpha: 0.06,
  innerGlowAlpha: 0,
  contactShadow: '0 1px 2px rgb(0 0 0 / 0.4)',
  glowAlpha: 0.22,
  glowSpread: '0 8px 24px',
  innerOnly: false,
  centerGlowAlpha: 0,
  centerGlowSize: '60%',
  surfaceAlpha: 1,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Read and merge a persisted JSON value over `DEFAULT_FINISH_CONFIG`. SSR-safe. */
function readStorage(): IFinishConfig {
  if (typeof window === 'undefined') return DEFAULT_FINISH_CONFIG;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_FINISH_CONFIG;
    const parsed = JSON.parse(raw) as Partial<IFinishConfig>;
    // Merge: defaults first, then stored value so new fields are always present.
    return { ...DEFAULT_FINISH_CONFIG, ...parsed };
  } catch {
    return DEFAULT_FINISH_CONFIG;
  }
}

/** Persist the full config to localStorage. SSR-safe. */
function writeStorage(value: IFinishConfig): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Quota exceeded or private-mode — silently ignore.
  }
}

// ─── Module-level singleton signal ────────────────────────────────────────────

const [config, setConfig] = createSignal<IFinishConfig>(readStorage());

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Reactive accessor for the finish-effect configuration.
 *
 * Solid tracks reads inside `createMemo` / JSX automatically.
 * The signal is initialised once on module-load from `localStorage`
 * (browser-only guard). New fields are always back-filled with
 * `DEFAULT_FINISH_CONFIG` so adds are non-breaking.
 *
 * Storage key: `omnifield-finish-config` (JSON, merged over defaults).
 */
export const useFinishConfig = (): Accessor<IFinishConfig> => config;

/**
 * Merge a partial patch into the current finish config, update the signal,
 * and persist the result to `localStorage`.
 *
 * Only the supplied keys are changed; all other keys keep their current value.
 *
 * @example
 *   setFinishConfig({ centerGlowAlpha: 0.3, innerOnly: true });
 */
export const setFinishConfig = (patch: Partial<IFinishConfig>): void => {
  const next: IFinishConfig = { ...config(), ...patch };
  setConfig(next);
  writeStorage(next);
};

/**
 * Reset all finish-config parameters to `DEFAULT_FINISH_CONFIG`,
 * update the signal, and clear the `localStorage` entry.
 */
export const resetFinishConfig = (): void => {
  setConfig(DEFAULT_FINISH_CONFIG);
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Silently ignore.
    }
  }
};

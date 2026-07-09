import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// localStorage mock — must be set up BEFORE importing the module because the
// module reads localStorage at module-initialisation time.
// ---------------------------------------------------------------------------

const localStorageStore: Record<string, string> = {};

const localStorageMock = {
  getItem: vi.fn((key: string) => localStorageStore[key] ?? null),
  setItem: vi.fn((key: string, value: string) => {
    localStorageStore[key] = value;
  }),
  removeItem: vi.fn((key: string) => {
    delete localStorageStore[key];
  }),
  clear: vi.fn(() => {
    for (const k of Object.keys(localStorageStore)) delete localStorageStore[k];
  }),
};

const documentElementAttrs: Record<string, string | undefined> = {};

const documentElementMock = {
  setAttribute: vi.fn((attr: string, val: string) => {
    documentElementAttrs[attr] = val;
  }),
  removeAttribute: vi.fn((attr: string) => {
    delete documentElementAttrs[attr];
  }),
  hasAttribute: (attr: string) => attr in documentElementAttrs,
};

vi.stubGlobal('window', { localStorage: localStorageMock });
vi.stubGlobal('localStorage', localStorageMock);
vi.stubGlobal('document', { documentElement: documentElementMock });

// ---------------------------------------------------------------------------
// Import module AFTER stubs are in place.
// ---------------------------------------------------------------------------

async function loadModule() {
  const mod = await import('../switcher/finishConfig');
  return mod;
}

describe('useFinishConfig / setFinishConfig / resetFinishConfig', () => {
  beforeEach(() => {
    vi.resetModules();
    localStorageMock.clear();
    localStorageMock.getItem.mockClear();
    localStorageMock.setItem.mockClear();
    localStorageMock.removeItem.mockClear();
  });

  afterEach(() => {
    vi.resetModules();
  });

  // ── DEFAULT_FINISH_CONFIG ──────────────────────────────────────────────────

  it('exports DEFAULT_FINISH_CONFIG with approved preset values', async () => {
    const { DEFAULT_FINISH_CONFIG } = await loadModule();

    expect(DEFAULT_FINISH_CONFIG.topForegroundAlpha).toBe(0.09);
    expect(DEFAULT_FINISH_CONFIG.topStopPosition).toBe(0);
    expect(DEFAULT_FINISH_CONFIG.midCardAlpha).toBe(0.7);
    expect(DEFAULT_FINISH_CONFIG.midStopPosition).toBe(45);
    expect(DEFAULT_FINISH_CONFIG.bottomPrimaryAlpha).toBe(0.18);
    expect(DEFAULT_FINISH_CONFIG.bottomStopPosition).toBe(100);
    expect(DEFAULT_FINISH_CONFIG.hairlineAlpha).toBe(0.4);
    expect(DEFAULT_FINISH_CONFIG.innerBorderAlpha).toBe(0.06);
    expect(DEFAULT_FINISH_CONFIG.contactShadow).toBe('0 1px 2px rgb(0 0 0 / 0.4)');
    expect(DEFAULT_FINISH_CONFIG.glowAlpha).toBe(0.22);
    expect(DEFAULT_FINISH_CONFIG.glowSpread).toBe('0 8px 24px');
    expect(DEFAULT_FINISH_CONFIG.innerOnly).toBe(false);
    expect(DEFAULT_FINISH_CONFIG.centerGlowAlpha).toBe(0);
    expect(DEFAULT_FINISH_CONFIG.centerGlowSize).toBe('60%');
    expect(DEFAULT_FINISH_CONFIG.surfaceAlpha).toBe(1);
    expect(DEFAULT_FINISH_CONFIG.innerGlowAlpha).toBe(0);
  });

  // ── Initial state (no localStorage) ────────────────────────────────────────

  it('defaults to DEFAULT_FINISH_CONFIG when localStorage is empty', async () => {
    const { useFinishConfig, DEFAULT_FINISH_CONFIG } = await loadModule();
    expect(useFinishConfig()()).toEqual(DEFAULT_FINISH_CONFIG);
  });

  // ── localStorage hydration ──────────────────────────────────────────────────

  it('hydrates from localStorage on module-load', async () => {
    localStorageStore['omnifield-finish-config'] = JSON.stringify({ centerGlowAlpha: 0.5 });
    const { useFinishConfig, DEFAULT_FINISH_CONFIG } = await loadModule();
    const cfg = useFinishConfig()();
    // Stored key is applied.
    expect(cfg.centerGlowAlpha).toBe(0.5);
    // All other keys come from defaults.
    expect(cfg.topForegroundAlpha).toBe(DEFAULT_FINISH_CONFIG.topForegroundAlpha);
    expect(cfg.innerOnly).toBe(DEFAULT_FINISH_CONFIG.innerOnly);
  });

  it('falls back to defaults when localStorage contains invalid JSON', async () => {
    localStorageStore['omnifield-finish-config'] = '{not valid json}';
    const { useFinishConfig, DEFAULT_FINISH_CONFIG } = await loadModule();
    expect(useFinishConfig()()).toEqual(DEFAULT_FINISH_CONFIG);
  });

  it('merges stored partial over defaults (new fields always present)', async () => {
    // Simulate stored config from an older version missing new knobs.
    localStorageStore['omnifield-finish-config'] = JSON.stringify({
      topForegroundAlpha: 0.15,
    });
    const { useFinishConfig, DEFAULT_FINISH_CONFIG } = await loadModule();
    const cfg = useFinishConfig()();
    expect(cfg.topForegroundAlpha).toBe(0.15);
    // New knobs fall back to defaults.
    expect(cfg.centerGlowAlpha).toBe(DEFAULT_FINISH_CONFIG.centerGlowAlpha);
    expect(cfg.centerGlowSize).toBe(DEFAULT_FINISH_CONFIG.centerGlowSize);
    expect(cfg.surfaceAlpha).toBe(DEFAULT_FINISH_CONFIG.surfaceAlpha);
    expect(cfg.innerOnly).toBe(DEFAULT_FINISH_CONFIG.innerOnly);
    expect(cfg.innerGlowAlpha).toBe(DEFAULT_FINISH_CONFIG.innerGlowAlpha);
  });

  // ── setFinishConfig ─────────────────────────────────────────────────────────

  it('setFinishConfig merges patch and keeps other fields unchanged', async () => {
    const { useFinishConfig, setFinishConfig, DEFAULT_FINISH_CONFIG } = await loadModule();

    setFinishConfig({ centerGlowAlpha: 0.3 });

    const cfg = useFinishConfig()();
    expect(cfg.centerGlowAlpha).toBe(0.3);
    // All other fields preserved from defaults.
    expect(cfg.topForegroundAlpha).toBe(DEFAULT_FINISH_CONFIG.topForegroundAlpha);
    expect(cfg.glowAlpha).toBe(DEFAULT_FINISH_CONFIG.glowAlpha);
    expect(cfg.contactShadow).toBe(DEFAULT_FINISH_CONFIG.contactShadow);
  });

  it('setFinishConfig can update multiple fields at once', async () => {
    const { useFinishConfig, setFinishConfig } = await loadModule();

    setFinishConfig({ innerOnly: true, surfaceAlpha: 0.85, centerGlowAlpha: 0.1 });

    const cfg = useFinishConfig()();
    expect(cfg.innerOnly).toBe(true);
    expect(cfg.surfaceAlpha).toBe(0.85);
    expect(cfg.centerGlowAlpha).toBe(0.1);
  });

  it('setFinishConfig persists result to localStorage as JSON', async () => {
    const { setFinishConfig } = await loadModule();

    setFinishConfig({ centerGlowAlpha: 0.3 });

    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'omnifield-finish-config',
      expect.stringContaining('"centerGlowAlpha":0.3'),
    );
  });

  it('setFinishConfig persisted JSON contains all fields', async () => {
    const { setFinishConfig } = await loadModule();

    setFinishConfig({ innerOnly: true });

    const lastCall = localStorageMock.setItem.mock.calls.at(-1);
    expect(lastCall).toBeDefined();
    const stored = JSON.parse(lastCall![1] as string);
    // All IFinishConfig keys must be present.
    expect(stored).toHaveProperty('topForegroundAlpha');
    expect(stored).toHaveProperty('centerGlowSize');
    expect(stored).toHaveProperty('surfaceAlpha');
    expect(stored.innerOnly).toBe(true);
  });

  it('setFinishConfig is additive — successive patches accumulate', async () => {
    const { useFinishConfig, setFinishConfig } = await loadModule();

    setFinishConfig({ centerGlowAlpha: 0.3 });
    setFinishConfig({ surfaceAlpha: 0.9 });

    const cfg = useFinishConfig()();
    // Both patches should survive.
    expect(cfg.centerGlowAlpha).toBe(0.3);
    expect(cfg.surfaceAlpha).toBe(0.9);
  });

  // ── resetFinishConfig ───────────────────────────────────────────────────────

  it('resetFinishConfig returns signal to DEFAULT_FINISH_CONFIG', async () => {
    const { useFinishConfig, setFinishConfig, resetFinishConfig, DEFAULT_FINISH_CONFIG } =
      await loadModule();

    setFinishConfig({ centerGlowAlpha: 0.5, innerOnly: true });
    resetFinishConfig();

    expect(useFinishConfig()()).toEqual(DEFAULT_FINISH_CONFIG);
  });

  it('resetFinishConfig removes localStorage entry', async () => {
    const { setFinishConfig, resetFinishConfig } = await loadModule();

    setFinishConfig({ surfaceAlpha: 0.5 });
    localStorageMock.removeItem.mockClear();

    resetFinishConfig();

    expect(localStorageMock.removeItem).toHaveBeenCalledWith('omnifield-finish-config');
  });

  it('resetFinishConfig after reset gives defaults on next module-load', async () => {
    const { setFinishConfig, resetFinishConfig } = await loadModule();

    setFinishConfig({ glowAlpha: 0.99 });
    resetFinishConfig();

    // Simulate fresh module-load (vi.resetModules called in beforeEach).
    vi.resetModules();
    const { useFinishConfig, DEFAULT_FINISH_CONFIG } = await loadModule();
    expect(useFinishConfig()()).toEqual(DEFAULT_FINISH_CONFIG);
  });

  // ── independence ─────────────────────────────────────────────────────────────

  it('is independent of finishMode — no shared state', async () => {
    const [configMod, modeMod] = await Promise.all([
      loadModule(),
      import('../switcher/finishMode'),
    ]);

    configMod.setFinishConfig({ innerOnly: true });

    // finishMode is unaffected.
    expect(modeMod.useFinishMode()()).toBe(false);
    expect(configMod.useFinishConfig()().innerOnly).toBe(true);
  });

  // ── innerGlowAlpha ───────────────────────────────────────────────────────────

  it('innerGlowAlpha defaults to 0 (off — no regression)', async () => {
    const { DEFAULT_FINISH_CONFIG, useFinishConfig } = await loadModule();
    expect(DEFAULT_FINISH_CONFIG.innerGlowAlpha).toBe(0);
    expect(useFinishConfig()().innerGlowAlpha).toBe(0);
  });

  it('setFinishConfig({ innerGlowAlpha: 0.3 }) updates value and persists', async () => {
    const { useFinishConfig, setFinishConfig } = await loadModule();

    setFinishConfig({ innerGlowAlpha: 0.3 });

    expect(useFinishConfig()().innerGlowAlpha).toBe(0.3);
    const lastCall = localStorageMock.setItem.mock.calls.at(-1);
    expect(lastCall).toBeDefined();
    const stored = JSON.parse(lastCall![1] as string);
    expect(stored.innerGlowAlpha).toBe(0.3);
  });

  it('old stored config without innerGlowAlpha hydrates with default 0', async () => {
    // Simulate a config saved before innerGlowAlpha was introduced.
    localStorageStore['omnifield-finish-config'] = JSON.stringify({
      glowAlpha: 0.5,
      // innerGlowAlpha intentionally absent
    });
    const { useFinishConfig } = await loadModule();
    expect(useFinishConfig()().innerGlowAlpha).toBe(0);
  });

  it('innerGlowAlpha is preserved across successive setFinishConfig patches', async () => {
    const { useFinishConfig, setFinishConfig } = await loadModule();

    setFinishConfig({ innerGlowAlpha: 0.4 });
    setFinishConfig({ surfaceAlpha: 0.9 });

    expect(useFinishConfig()().innerGlowAlpha).toBe(0.4);
  });

  // ── SSR guard ────────────────────────────────────────────────────────────────

  it('does not throw when window is undefined (SSR simulation)', async () => {
    // Temporarily hide window.
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;

    try {
      vi.resetModules();
      // Module-load must not throw even without window.
      await expect(loadModule()).resolves.toBeDefined();
    } finally {
      (globalThis as Record<string, unknown>).window = origWindow;
    }
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// localStorage + document stubs — set up BEFORE importing the module because
// the module reads localStorage and calls applyAmbient() at module-init time.
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

const cssVars: Record<string, string> = {};

const documentElementMock = {
  style: {
    setProperty: vi.fn((prop: string, val: string) => {
      cssVars[prop] = val;
    }),
    getPropertyValue: vi.fn((prop: string) => cssVars[prop] ?? ''),
  },
};

vi.stubGlobal('window', { localStorage: localStorageMock });
vi.stubGlobal('localStorage', localStorageMock);
vi.stubGlobal('document', { documentElement: documentElementMock });

// ---------------------------------------------------------------------------
// Import module AFTER stubs are in place.
// ---------------------------------------------------------------------------

async function loadModule() {
  const mod = await import('../switcher/ambientConfig');
  return mod;
}

describe('ambientConfig', () => {
  beforeEach(() => {
    vi.resetModules();
    localStorageMock.clear();
    localStorageMock.getItem.mockClear();
    localStorageMock.setItem.mockClear();
    localStorageMock.removeItem.mockClear();
    documentElementMock.style.setProperty.mockClear();
    for (const k of Object.keys(cssVars)) delete cssVars[k];
  });

  afterEach(() => {
    vi.resetModules();
  });

  // ── DEFAULT_AMBIENT_CONFIG ─────────────────────────────────────────────────

  it('exports DEFAULT_AMBIENT_CONFIG with the approved 3-glow preset', async () => {
    const { DEFAULT_AMBIENT_CONFIG } = await loadModule();

    expect(DEFAULT_AMBIENT_CONFIG.glows).toHaveLength(3);

    const [g0, g1, g2] = DEFAULT_AMBIENT_CONFIG.glows;
    expect(g0).toEqual({ x: 8, y: -6, size: 55, alpha: 0.28, tint: 'primary' });
    expect(g1).toEqual({ x: 112, y: 116, size: 50, alpha: 0.22, tint: 'primary' });
    expect(g2).toEqual({ x: 96, y: 4, size: 42, alpha: 0.14, tint: 'accent' });
  });

  // ── Initial state (no localStorage) ────────────────────────────────────────

  it('defaults to DEFAULT_AMBIENT_CONFIG when localStorage is empty', async () => {
    const { useAmbientConfig, DEFAULT_AMBIENT_CONFIG } = await loadModule();
    expect(useAmbientConfig()()).toEqual(DEFAULT_AMBIENT_CONFIG);
  });

  // ── localStorage hydration ──────────────────────────────────────────────────

  it('hydrates from localStorage on module-load', async () => {
    const customGlows = [{ x: 10, y: 20, size: 30, alpha: 0.5, tint: 'accent' as const }];
    localStorageStore['omnifield-ambient-config'] = JSON.stringify({ glows: customGlows });

    const { useAmbientConfig } = await loadModule();
    expect(useAmbientConfig()().glows).toEqual(customGlows);
  });

  it('falls back to defaults when localStorage contains invalid JSON', async () => {
    localStorageStore['omnifield-ambient-config'] = '{not valid json}';
    const { useAmbientConfig, DEFAULT_AMBIENT_CONFIG } = await loadModule();
    expect(useAmbientConfig()()).toEqual(DEFAULT_AMBIENT_CONFIG);
  });

  // ── applyAmbient ───────────────────────────────────────────────────────────

  it('applyAmbient sets --app-ambient on document.documentElement', async () => {
    const { applyAmbient } = await loadModule();

    documentElementMock.style.setProperty.mockClear();
    applyAmbient({
      glows: [{ x: 50, y: 50, size: 40, alpha: 0.2, tint: 'primary' }],
    });

    expect(documentElementMock.style.setProperty).toHaveBeenCalledWith(
      '--app-ambient',
      expect.stringContaining('radial-gradient'),
    );
  });

  it('applyAmbient uses two-value size (size% size%) for valid radial-gradient CSS', async () => {
    const { applyAmbient } = await loadModule();

    applyAmbient({
      glows: [{ x: 10, y: 20, size: 55, alpha: 0.28, tint: 'primary' }],
    });

    const calls = documentElementMock.style.setProperty.mock.calls;
    const ambientCall = calls.find(([prop]) => prop === '--app-ambient');
    expect(ambientCall).toBeDefined();
    // Must contain "55% 55%" (two-value size) — single "55%" is invalid in radial-gradient.
    expect(ambientCall![1]).toContain('55% 55%');
  });

  it('applyAmbient encodes alpha as integer mix-percentage', async () => {
    const { applyAmbient } = await loadModule();

    applyAmbient({
      glows: [{ x: 0, y: 0, size: 40, alpha: 0.28, tint: 'primary' }],
    });

    const calls = documentElementMock.style.setProperty.mock.calls;
    const ambientCall = calls.find(([prop]) => prop === '--app-ambient');
    expect(ambientCall).toBeDefined();
    // 0.28 * 100 = 28%
    expect(ambientCall![1]).toContain('28%');
  });

  it('applyAmbient uses var(--primary) for tint="primary"', async () => {
    const { applyAmbient } = await loadModule();

    applyAmbient({ glows: [{ x: 0, y: 0, size: 40, alpha: 0.1, tint: 'primary' }] });

    const calls = documentElementMock.style.setProperty.mock.calls;
    const ambientCall = calls.find(([prop]) => prop === '--app-ambient');
    // Raw theme var — always emitted by [data-theme], no --color-* fallback needed.
    expect(ambientCall![1]).toContain('var(--primary)');
    expect(ambientCall![1]).not.toContain('--color-primary');
  });

  it('applyAmbient uses var(--accent) for tint="accent"', async () => {
    const { applyAmbient } = await loadModule();

    applyAmbient({ glows: [{ x: 0, y: 0, size: 40, alpha: 0.1, tint: 'accent' }] });

    const calls = documentElementMock.style.setProperty.mock.calls;
    const ambientCall = calls.find(([prop]) => prop === '--app-ambient');
    // Raw theme var — always emitted by [data-theme], no --color-* fallback needed.
    expect(ambientCall![1]).toContain('var(--accent)');
    expect(ambientCall![1]).not.toContain('--color-accent');
  });

  it('applyAmbient joins multiple glows with commas', async () => {
    const { applyAmbient } = await loadModule();

    documentElementMock.style.setProperty.mockClear();
    applyAmbient({
      glows: [
        { x: 10, y: 10, size: 30, alpha: 0.2, tint: 'primary' },
        { x: 90, y: 90, size: 30, alpha: 0.1, tint: 'accent' },
      ],
    });

    const calls = documentElementMock.style.setProperty.mock.calls;
    const ambientCall = calls.find(([prop]) => prop === '--app-ambient');
    expect(ambientCall).toBeDefined();
    // Two radial-gradients → must have a comma separator.
    const value: string = ambientCall![1];
    const gradientCount = (value.match(/radial-gradient/g) ?? []).length;
    expect(gradientCount).toBe(2);
  });

  it('applyAmbient sets --app-ambient to "none" when glows list is empty', async () => {
    const { applyAmbient } = await loadModule();

    documentElementMock.style.setProperty.mockClear();
    applyAmbient({ glows: [] });

    const calls = documentElementMock.style.setProperty.mock.calls;
    const ambientCall = calls.find(([prop]) => prop === '--app-ambient');
    expect(ambientCall).toBeDefined();
    expect(ambientCall![1]).toBe('none');
  });

  // ── module-load applies ambient ────────────────────────────────────────────

  it('applies --app-ambient on module-load (browser-only)', async () => {
    await loadModule();

    const calls = documentElementMock.style.setProperty.mock.calls;
    const ambientCall = calls.find(([prop]) => prop === '--app-ambient');
    expect(ambientCall).toBeDefined();
    // Default 3-glow preset → must contain radial-gradient.
    expect(ambientCall![1]).toContain('radial-gradient');
  });

  // ── setAmbientGlow ────────────────────────────────────────────────────────

  it('setAmbientGlow patches the glow at the given index', async () => {
    const { useAmbientConfig, setAmbientGlow } = await loadModule();

    setAmbientGlow(0, { alpha: 0.99 });

    const glows = useAmbientConfig()().glows;
    expect(glows[0].alpha).toBe(0.99);
    // Other fields of that glow should be preserved.
    expect(glows[0].x).toBe(8);
    expect(glows[0].tint).toBe('primary');
    // Other glows are untouched.
    expect(glows[1]).toEqual({ x: 112, y: 116, size: 50, alpha: 0.22, tint: 'primary' });
  });

  it('setAmbientGlow calls applyAmbient (updates --app-ambient)', async () => {
    const { setAmbientGlow } = await loadModule();

    documentElementMock.style.setProperty.mockClear();
    setAmbientGlow(1, { size: 99 });

    const calls = documentElementMock.style.setProperty.mock.calls;
    const ambientCall = calls.find(([prop]) => prop === '--app-ambient');
    expect(ambientCall).toBeDefined();
    expect(ambientCall![1]).toContain('99% 99%');
  });

  it('setAmbientGlow persists to localStorage', async () => {
    const { setAmbientGlow } = await loadModule();

    setAmbientGlow(0, { alpha: 0.5 });

    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'omnifield-ambient-config',
      expect.stringContaining('"alpha":0.5'),
    );
  });

  it('setAmbientGlow is a no-op for out-of-range index', async () => {
    const { useAmbientConfig, setAmbientGlow, DEFAULT_AMBIENT_CONFIG } = await loadModule();

    setAmbientGlow(99, { alpha: 0.0 });

    expect(useAmbientConfig()()).toEqual(DEFAULT_AMBIENT_CONFIG);
  });

  // ── addAmbientGlow ────────────────────────────────────────────────────────

  it('addAmbientGlow appends a glow with built-in defaults', async () => {
    const { useAmbientConfig, addAmbientGlow } = await loadModule();
    const initialLen = useAmbientConfig()().glows.length;

    addAmbientGlow();

    const glows = useAmbientConfig()().glows;
    expect(glows).toHaveLength(initialLen + 1);

    const added = glows[glows.length - 1];
    expect(added.x).toBe(50);
    expect(added.y).toBe(50);
    expect(added.size).toBe(40);
    expect(added.alpha).toBe(0.15);
    expect(added.tint).toBe('primary');
  });

  it('addAmbientGlow applies the caller patch over defaults', async () => {
    const { useAmbientConfig, addAmbientGlow } = await loadModule();

    addAmbientGlow({ x: 10, alpha: 0.9, tint: 'accent' });

    const glows = useAmbientConfig()().glows;
    const added = glows[glows.length - 1];
    expect(added.x).toBe(10);
    expect(added.alpha).toBe(0.9);
    expect(added.tint).toBe('accent');
    // Fields not in patch come from built-in defaults.
    expect(added.y).toBe(50);
    expect(added.size).toBe(40);
  });

  it('addAmbientGlow updates --app-ambient', async () => {
    const { addAmbientGlow } = await loadModule();

    documentElementMock.style.setProperty.mockClear();
    addAmbientGlow({ alpha: 0.77 });

    const calls = documentElementMock.style.setProperty.mock.calls;
    const ambientCall = calls.find(([prop]) => prop === '--app-ambient');
    expect(ambientCall).toBeDefined();
    // 0.77 × 100 = 77%
    expect(ambientCall![1]).toContain('77%');
  });

  it('addAmbientGlow persists to localStorage', async () => {
    const { addAmbientGlow } = await loadModule();

    addAmbientGlow({ x: 77 });

    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'omnifield-ambient-config',
      expect.stringContaining('"x":77'),
    );
  });

  // ── removeAmbientGlow ────────────────────────────────────────────────────

  it('removeAmbientGlow removes the glow at the given index', async () => {
    const { useAmbientConfig, removeAmbientGlow, DEFAULT_AMBIENT_CONFIG } = await loadModule();

    removeAmbientGlow(1); // remove middle glow

    const glows = useAmbientConfig()().glows;
    expect(glows).toHaveLength(DEFAULT_AMBIENT_CONFIG.glows.length - 1);
    // Remaining glows: index 0 and index 2 from original.
    expect(glows[0]).toEqual(DEFAULT_AMBIENT_CONFIG.glows[0]);
    expect(glows[1]).toEqual(DEFAULT_AMBIENT_CONFIG.glows[2]);
  });

  it('removeAmbientGlow sets --app-ambient to "none" when all glows removed', async () => {
    const { removeAmbientGlow, DEFAULT_AMBIENT_CONFIG } = await loadModule();

    // Remove all 3 default glows.
    // Each removal re-indexes, so always remove index 0.
    for (let i = 0; i < DEFAULT_AMBIENT_CONFIG.glows.length; i++) {
      removeAmbientGlow(0);
    }

    documentElementMock.style.setProperty.mockClear();
    // One more removal attempt should be a no-op (already empty).
    removeAmbientGlow(0);

    // After emptying the list the last real call should have set 'none'.
    // Re-call applyAmbient manually to check current state.
    const { useAmbientConfig, applyAmbient } = await import('../switcher/ambientConfig');
    // The signal should be empty at this point.
    // Use a fresh applyAmbient call to verify the value:
    documentElementMock.style.setProperty.mockClear();
    applyAmbient(useAmbientConfig()());

    const calls = documentElementMock.style.setProperty.mock.calls;
    const ambientCall = calls.find(([prop]) => prop === '--app-ambient');
    expect(ambientCall).toBeDefined();
    expect(ambientCall![1]).toBe('none');
  });

  it('removeAmbientGlow persists to localStorage', async () => {
    const { removeAmbientGlow } = await loadModule();

    removeAmbientGlow(0);

    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'omnifield-ambient-config',
      expect.any(String),
    );
  });

  it('removeAmbientGlow is a no-op for out-of-range index', async () => {
    const { useAmbientConfig, removeAmbientGlow, DEFAULT_AMBIENT_CONFIG } = await loadModule();

    removeAmbientGlow(-1);
    removeAmbientGlow(999);

    expect(useAmbientConfig()()).toEqual(DEFAULT_AMBIENT_CONFIG);
  });

  // ── resetAmbientConfig ────────────────────────────────────────────────────

  it('resetAmbientConfig returns signal to DEFAULT_AMBIENT_CONFIG', async () => {
    const { useAmbientConfig, setAmbientGlow, resetAmbientConfig, DEFAULT_AMBIENT_CONFIG } =
      await loadModule();

    setAmbientGlow(0, { alpha: 0.99 });
    resetAmbientConfig();

    expect(useAmbientConfig()()).toEqual(DEFAULT_AMBIENT_CONFIG);
  });

  it('resetAmbientConfig removes localStorage entry', async () => {
    const { setAmbientGlow, resetAmbientConfig } = await loadModule();

    setAmbientGlow(0, { alpha: 0.1 });
    localStorageMock.removeItem.mockClear();

    resetAmbientConfig();

    expect(localStorageMock.removeItem).toHaveBeenCalledWith('omnifield-ambient-config');
  });

  it('resetAmbientConfig re-applies default --app-ambient', async () => {
    const { setAmbientGlow, resetAmbientConfig } = await loadModule();

    setAmbientGlow(0, { alpha: 0.01 });
    documentElementMock.style.setProperty.mockClear();

    resetAmbientConfig();

    const calls = documentElementMock.style.setProperty.mock.calls;
    const ambientCall = calls.find(([prop]) => prop === '--app-ambient');
    expect(ambientCall).toBeDefined();
    // Default preset has 3 radial-gradients.
    const value: string = ambientCall![1];
    const gradientCount = (value.match(/radial-gradient/g) ?? []).length;
    expect(gradientCount).toBe(3);
  });

  it('resetAmbientConfig after reset gives defaults on next module-load', async () => {
    const { setAmbientGlow, resetAmbientConfig } = await loadModule();

    setAmbientGlow(2, { alpha: 0.99 });
    resetAmbientConfig();

    vi.resetModules();
    const { useAmbientConfig, DEFAULT_AMBIENT_CONFIG } = await loadModule();
    expect(useAmbientConfig()()).toEqual(DEFAULT_AMBIENT_CONFIG);
  });

  // ── successive mutations ──────────────────────────────────────────────────

  it('successive mutations accumulate correctly', async () => {
    const { useAmbientConfig, setAmbientGlow, addAmbientGlow } = await loadModule();

    setAmbientGlow(0, { alpha: 0.5 });
    addAmbientGlow({ x: 77, tint: 'accent' });

    const glows = useAmbientConfig()().glows;
    expect(glows[0].alpha).toBe(0.5);
    expect(glows[glows.length - 1].x).toBe(77);
    expect(glows[glows.length - 1].tint).toBe('accent');
  });

  // ── SSR guard ────────────────────────────────────────────────────────────

  it('does not throw when window is undefined (SSR simulation)', async () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;

    try {
      vi.resetModules();
      await expect(loadModule()).resolves.toBeDefined();
    } finally {
      (globalThis as Record<string, unknown>).window = origWindow;
    }
  });
});

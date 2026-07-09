import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// localStorage + window + document mocks — must be set up BEFORE importing
// the module because the module reads localStorage and calls applyFinishMode
// at module-initialisation time.
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
vi.stubGlobal('document', {
  documentElement: documentElementMock,
});

// ---------------------------------------------------------------------------
// Import module AFTER stubs are in place.
// ---------------------------------------------------------------------------

async function loadModule() {
  const mod = await import('../switcher/finishMode');
  return mod;
}

describe('useFinishMode / setFinishMode / toggleFinishMode', () => {
  beforeEach(() => {
    vi.resetModules();
    localStorageMock.clear();
    localStorageMock.getItem.mockClear();
    localStorageMock.setItem.mockClear();
    documentElementMock.setAttribute.mockClear();
    documentElementMock.removeAttribute.mockClear();
    for (const k of Object.keys(documentElementAttrs)) delete documentElementAttrs[k];
  });

  afterEach(() => {
    vi.resetModules();
  });

  // ── defaults ──────────────────────────────────────────────────────────────

  it('defaults to false when localStorage is empty', async () => {
    const { useFinishMode } = await loadModule();
    expect(useFinishMode()()).toBe(false);
  });

  it('does NOT set data-finish on <html> by default', async () => {
    await loadModule();
    expect(documentElementMock.setAttribute).not.toHaveBeenCalledWith(
      'data-finish',
      expect.anything(),
    );
    expect(documentElementAttrs).not.toHaveProperty('data-finish');
  });

  // ── localStorage hydration ───────────────────────────────────────────────

  it('reads stored true from localStorage', async () => {
    localStorageStore['omnifield-finish-mode'] = 'true';
    const { useFinishMode } = await loadModule();
    expect(useFinishMode()()).toBe(true);
  });

  it('reads stored false from localStorage', async () => {
    localStorageStore['omnifield-finish-mode'] = 'false';
    const { useFinishMode } = await loadModule();
    expect(useFinishMode()()).toBe(false);
  });

  it('applies data-finish on module-load when localStorage is true', async () => {
    localStorageStore['omnifield-finish-mode'] = 'true';
    await loadModule();
    expect(documentElementMock.setAttribute).toHaveBeenCalledWith('data-finish', '');
  });

  // ── setFinishMode ─────────────────────────────────────────────────────────

  it('setFinishMode(true) updates the signal', async () => {
    const { useFinishMode, setFinishMode } = await loadModule();
    expect(useFinishMode()()).toBe(false);
    setFinishMode(true);
    expect(useFinishMode()()).toBe(true);
  });

  it('setFinishMode(false) updates the signal', async () => {
    const { useFinishMode, setFinishMode } = await loadModule();
    setFinishMode(true);
    setFinishMode(false);
    expect(useFinishMode()()).toBe(false);
  });

  it('setFinishMode(true) sets data-finish on document.documentElement', async () => {
    const { setFinishMode } = await loadModule();
    setFinishMode(true);
    expect(documentElementMock.setAttribute).toHaveBeenCalledWith('data-finish', '');
  });

  it('setFinishMode(false) removes data-finish from document.documentElement', async () => {
    const { setFinishMode } = await loadModule();
    setFinishMode(true);
    documentElementMock.removeAttribute.mockClear();
    setFinishMode(false);
    expect(documentElementMock.removeAttribute).toHaveBeenCalledWith('data-finish');
  });

  it('setFinishMode(true) persists true to localStorage', async () => {
    const { setFinishMode } = await loadModule();
    setFinishMode(true);
    expect(localStorageMock.setItem).toHaveBeenCalledWith('omnifield-finish-mode', 'true');
  });

  it('setFinishMode(false) persists false to localStorage', async () => {
    const { setFinishMode } = await loadModule();
    setFinishMode(false);
    expect(localStorageMock.setItem).toHaveBeenCalledWith('omnifield-finish-mode', 'false');
  });

  it('setFinishMode accepts an optional target element', async () => {
    const { setFinishMode } = await loadModule();
    const customEl = {
      setAttribute: vi.fn(),
      removeAttribute: vi.fn(),
    } as unknown as HTMLElement;
    setFinishMode(true, customEl);
    expect((customEl as any).setAttribute).toHaveBeenCalledWith('data-finish', '');
    expect(documentElementMock.setAttribute).not.toHaveBeenCalledWith('data-finish', '');
  });

  // ── toggleFinishMode ──────────────────────────────────────────────────────

  it('toggleFinishMode flips false → true', async () => {
    const { useFinishMode, toggleFinishMode } = await loadModule();
    expect(useFinishMode()()).toBe(false);
    toggleFinishMode();
    expect(useFinishMode()()).toBe(true);
  });

  it('toggleFinishMode flips true → false', async () => {
    const { useFinishMode, setFinishMode, toggleFinishMode } = await loadModule();
    setFinishMode(true);
    toggleFinishMode();
    expect(useFinishMode()()).toBe(false);
  });

  it('toggleFinishMode sets data-finish when flipping to true', async () => {
    const { toggleFinishMode } = await loadModule();
    toggleFinishMode(); // false → true
    expect(documentElementMock.setAttribute).toHaveBeenCalledWith('data-finish', '');
  });

  it('toggleFinishMode removes data-finish when flipping to false', async () => {
    const { setFinishMode, toggleFinishMode } = await loadModule();
    setFinishMode(true);
    documentElementMock.removeAttribute.mockClear();
    toggleFinishMode(); // true → false
    expect(documentElementMock.removeAttribute).toHaveBeenCalledWith('data-finish');
  });

  it('toggleFinishMode persists the toggled value', async () => {
    const { toggleFinishMode } = await loadModule();
    toggleFinishMode(); // false → true
    expect(localStorageMock.setItem).toHaveBeenLastCalledWith('omnifield-finish-mode', 'true');
    toggleFinishMode(); // true → false
    expect(localStorageMock.setItem).toHaveBeenLastCalledWith('omnifield-finish-mode', 'false');
  });

  // ── independence ──────────────────────────────────────────────────────────

  it('is independent of settingsMode — no shared state', async () => {
    const [finishMod, settingsMod] = await Promise.all([
      loadModule(),
      import('../switcher/settingsMode'),
    ]);
    finishMod.setFinishMode(true);
    expect(settingsMod.useSettingsMode()()).toBe(false);
    expect(finishMod.useFinishMode()()).toBe(true);
  });
});

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

// Patch globalThis so `typeof window !== 'undefined'` is true and
// localStorage calls hit our mock.
vi.stubGlobal('window', { localStorage: localStorageMock });
vi.stubGlobal('localStorage', localStorageMock);

// ---------------------------------------------------------------------------
// Import module AFTER stubs are in place.
// ---------------------------------------------------------------------------

async function loadModule() {
  const mod = await import('../switcher/settingsMode');
  return mod;
}

describe('useSettingsMode / setSettingsMode / toggleSettingsMode', () => {
  beforeEach(() => {
    vi.resetModules();
    localStorageMock.clear();
    localStorageMock.getItem.mockClear();
    localStorageMock.setItem.mockClear();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('defaults to false when localStorage is empty', async () => {
    const { useSettingsMode } = await loadModule();
    expect(useSettingsMode()()).toBe(false);
  });

  it('reads initial value true from localStorage', async () => {
    localStorageStore['omnifield-settings-mode'] = 'true';
    const { useSettingsMode } = await loadModule();
    expect(useSettingsMode()()).toBe(true);
  });

  it('reads initial value false from localStorage', async () => {
    localStorageStore['omnifield-settings-mode'] = 'false';
    const { useSettingsMode } = await loadModule();
    expect(useSettingsMode()()).toBe(false);
  });

  it('setSettingsMode updates the signal to true', async () => {
    const { useSettingsMode, setSettingsMode } = await loadModule();
    expect(useSettingsMode()()).toBe(false);
    setSettingsMode(true);
    expect(useSettingsMode()()).toBe(true);
  });

  it('setSettingsMode updates the signal to false', async () => {
    const { useSettingsMode, setSettingsMode } = await loadModule();
    setSettingsMode(true);
    setSettingsMode(false);
    expect(useSettingsMode()()).toBe(false);
  });

  it('setSettingsMode persists true to localStorage', async () => {
    const { setSettingsMode } = await loadModule();
    setSettingsMode(true);
    expect(localStorageMock.setItem).toHaveBeenCalledWith('omnifield-settings-mode', 'true');
  });

  it('setSettingsMode persists false to localStorage', async () => {
    const { setSettingsMode } = await loadModule();
    setSettingsMode(false);
    expect(localStorageMock.setItem).toHaveBeenCalledWith('omnifield-settings-mode', 'false');
  });

  it('toggleSettingsMode flips false → true', async () => {
    const { useSettingsMode, toggleSettingsMode } = await loadModule();
    expect(useSettingsMode()()).toBe(false);
    toggleSettingsMode();
    expect(useSettingsMode()()).toBe(true);
  });

  it('toggleSettingsMode flips true → false', async () => {
    const { useSettingsMode, setSettingsMode, toggleSettingsMode } = await loadModule();
    setSettingsMode(true);
    toggleSettingsMode();
    expect(useSettingsMode()()).toBe(false);
  });

  it('toggleSettingsMode persists the toggled value', async () => {
    const { toggleSettingsMode } = await loadModule();
    toggleSettingsMode();
    expect(localStorageMock.setItem).toHaveBeenLastCalledWith('omnifield-settings-mode', 'true');
    toggleSettingsMode();
    expect(localStorageMock.setItem).toHaveBeenLastCalledWith('omnifield-settings-mode', 'false');
  });

  it('is independent of resizeMode — no shared state', async () => {
    // Both modules can be loaded simultaneously without interference.
    const [settingsMod, resizeMod] = await Promise.all([
      loadModule(),
      import('../switcher/resizeMode'),
    ]);
    settingsMod.setSettingsMode(true);
    // resizeMode remains at its own default
    expect(resizeMod.useResizeMode()()).toBe(true);
    expect(settingsMod.useSettingsMode()()).toBe(true);
  });
});

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

vi.stubGlobal('window', { localStorage: localStorageMock });
vi.stubGlobal('localStorage', localStorageMock);

// ---------------------------------------------------------------------------
// Import module AFTER stubs are in place.
// ---------------------------------------------------------------------------

async function loadModule() {
  const mod = await import('../switcher/dndMode');
  return mod;
}

describe('useDndMode / setDndMode / toggleDndMode', () => {
  beforeEach(() => {
    vi.resetModules();
    localStorageMock.clear();
    localStorageMock.getItem.mockClear();
    localStorageMock.setItem.mockClear();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('defaults to true when localStorage is empty', async () => {
    const { useDndMode } = await loadModule();
    expect(useDndMode()()).toBe(true);
  });

  it('reads stored true from localStorage', async () => {
    localStorageStore['omnifield-dnd-mode'] = 'true';
    const { useDndMode } = await loadModule();
    expect(useDndMode()()).toBe(true);
  });

  it('reads stored false from localStorage', async () => {
    localStorageStore['omnifield-dnd-mode'] = 'false';
    const { useDndMode } = await loadModule();
    expect(useDndMode()()).toBe(false);
  });

  it('setDndMode updates the signal to false', async () => {
    const { useDndMode, setDndMode } = await loadModule();
    expect(useDndMode()()).toBe(true);
    setDndMode(false);
    expect(useDndMode()()).toBe(false);
  });

  it('setDndMode updates the signal to true', async () => {
    const { useDndMode, setDndMode } = await loadModule();
    setDndMode(false);
    setDndMode(true);
    expect(useDndMode()()).toBe(true);
  });

  it('setDndMode persists true to localStorage', async () => {
    const { setDndMode } = await loadModule();
    setDndMode(true);
    expect(localStorageMock.setItem).toHaveBeenCalledWith('omnifield-dnd-mode', 'true');
  });

  it('setDndMode persists false to localStorage', async () => {
    const { setDndMode } = await loadModule();
    setDndMode(false);
    expect(localStorageMock.setItem).toHaveBeenCalledWith('omnifield-dnd-mode', 'false');
  });

  it('toggleDndMode flips true → false', async () => {
    const { useDndMode, toggleDndMode } = await loadModule();
    expect(useDndMode()()).toBe(true);
    toggleDndMode();
    expect(useDndMode()()).toBe(false);
  });

  it('toggleDndMode flips false → true', async () => {
    const { useDndMode, setDndMode, toggleDndMode } = await loadModule();
    setDndMode(false);
    toggleDndMode();
    expect(useDndMode()()).toBe(true);
  });

  it('toggleDndMode persists the toggled value', async () => {
    const { toggleDndMode } = await loadModule();
    toggleDndMode();
    expect(localStorageMock.setItem).toHaveBeenLastCalledWith('omnifield-dnd-mode', 'false');
    toggleDndMode();
    expect(localStorageMock.setItem).toHaveBeenLastCalledWith('omnifield-dnd-mode', 'true');
  });

  it('is independent of resizeMode — no shared state', async () => {
    const [dndMod, resizeMod] = await Promise.all([loadModule(), import('../switcher/resizeMode')]);
    dndMod.setDndMode(false);
    // resizeMode remains at its own default
    expect(resizeMod.useResizeMode()()).toBe(true);
    expect(dndMod.useDndMode()()).toBe(false);
  });
});

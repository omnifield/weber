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
  const mod = await import('../switcher/resizeMode');
  return mod;
}

describe('useResizeMode / setResizeMode / toggleResizeMode', () => {
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
    const { useResizeMode } = await loadModule();
    expect(useResizeMode()()).toBe(true);
  });

  it('reads stored true from localStorage', async () => {
    localStorageStore['omnifield-resize-mode'] = 'true';
    const { useResizeMode } = await loadModule();
    expect(useResizeMode()()).toBe(true);
  });

  it('reads stored false from localStorage', async () => {
    localStorageStore['omnifield-resize-mode'] = 'false';
    const { useResizeMode } = await loadModule();
    expect(useResizeMode()()).toBe(false);
  });

  it('setResizeMode updates the signal to false', async () => {
    const { useResizeMode, setResizeMode } = await loadModule();
    expect(useResizeMode()()).toBe(true);
    setResizeMode(false);
    expect(useResizeMode()()).toBe(false);
  });

  it('setResizeMode updates the signal to true', async () => {
    const { useResizeMode, setResizeMode } = await loadModule();
    setResizeMode(false);
    setResizeMode(true);
    expect(useResizeMode()()).toBe(true);
  });

  it('setResizeMode persists true to localStorage', async () => {
    const { setResizeMode } = await loadModule();
    setResizeMode(true);
    expect(localStorageMock.setItem).toHaveBeenCalledWith('omnifield-resize-mode', 'true');
  });

  it('setResizeMode persists false to localStorage', async () => {
    const { setResizeMode } = await loadModule();
    setResizeMode(false);
    expect(localStorageMock.setItem).toHaveBeenCalledWith('omnifield-resize-mode', 'false');
  });

  it('toggleResizeMode flips true → false', async () => {
    const { useResizeMode, toggleResizeMode } = await loadModule();
    expect(useResizeMode()()).toBe(true);
    toggleResizeMode();
    expect(useResizeMode()()).toBe(false);
  });

  it('toggleResizeMode flips false → true', async () => {
    const { useResizeMode, setResizeMode, toggleResizeMode } = await loadModule();
    setResizeMode(false);
    toggleResizeMode();
    expect(useResizeMode()()).toBe(true);
  });

  it('toggleResizeMode persists the toggled value', async () => {
    const { toggleResizeMode } = await loadModule();
    toggleResizeMode();
    expect(localStorageMock.setItem).toHaveBeenLastCalledWith('omnifield-resize-mode', 'false');
    toggleResizeMode();
    expect(localStorageMock.setItem).toHaveBeenLastCalledWith('omnifield-resize-mode', 'true');
  });
});

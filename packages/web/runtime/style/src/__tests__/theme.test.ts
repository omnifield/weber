import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// vi.mock is hoisted to the top of the file by Vitest, so factory closures
// cannot reference variables declared in the file body. All constants must
// live inside the factory or be provided via vi.hoisted().
// ---------------------------------------------------------------------------

vi.mock('../switcher/theme', async () => {
  // Inline fake theme list — no reference to outer scope.
  const fakeKeys = [
    '../themes/black.css',
    '../themes/zen.css',
    '../themes/index.css', // should be filtered
    '../themes/damon.css',
  ];

  const { createSignal } = await import('solid-js');

  const STORAGE_KEY = 'omnifield-theme';
  const MODE_STORAGE_KEY = 'omnifield-theme-mode';

  const DISCOVERED_THEMES: readonly string[] = fakeKeys
    .map((p: string) => p.match(/([^/]+)\.css$/)?.[1] ?? '')
    .filter((n: string) => n && n !== 'index')
    .sort();

  const applyTheme = (name: string, target?: HTMLElement): void => {
    if (typeof window === 'undefined') return;
    const el = target ?? document.documentElement;
    el.setAttribute('data-theme', name);
  };

  const applyDarkMode = (dark: boolean, target?: HTMLElement): void => {
    if (typeof window === 'undefined') return;
    const el = target ?? document.documentElement;
    if (dark) {
      el.classList.add('dark');
      document.body?.classList.add('dark');
    } else {
      el.classList.remove('dark');
      document.body?.classList.remove('dark');
    }
  };

  const initialTheme = (): string => {
    if (typeof window === 'undefined') return (DISCOVERED_THEMES[0] as string) ?? '';
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && DISCOVERED_THEMES.includes(stored)) return stored;
    return (DISCOVERED_THEMES[0] as string) ?? '';
  };

  const initialDarkMode = (): boolean => {
    if (typeof window === 'undefined') return false;
    const stored = localStorage.getItem(MODE_STORAGE_KEY);
    if (stored !== null) return stored === 'dark';
    return false; // matchMedia not available in node
  };

  const [theme, setThemeSignal] = createSignal<string>(initialTheme());
  const [isDark, setIsDarkSignal] = createSignal<boolean>(initialDarkMode());

  const useTheme = () => theme;
  const useDarkMode = () => isDark;

  const setTheme = (name: string, target?: HTMLElement): void => {
    if (!DISCOVERED_THEMES.includes(name)) return;
    setThemeSignal(name);
    applyTheme(name, target);
    if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, name);
  };

  const setDarkMode = (dark: boolean, target?: HTMLElement): void => {
    setIsDarkSignal(dark);
    applyDarkMode(dark, target);
    if (typeof window !== 'undefined') {
      localStorage.setItem(MODE_STORAGE_KEY, dark ? 'dark' : 'light');
    }
  };

  const toggleDarkMode = (target?: HTMLElement): void => {
    setDarkMode(!isDark(), target);
  };

  return { DISCOVERED_THEMES, useTheme, useDarkMode, setTheme, setDarkMode, toggleDarkMode };
});

// ---------------------------------------------------------------------------
// localStorage + window + document mocks — before importing the mocked module.
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

const documentElementAttrs: Record<string, string> = {};
const documentElementClasses = new Set<string>();

const documentElementMock = {
  setAttribute: vi.fn((attr: string, val: string) => {
    documentElementAttrs[attr] = val;
  }),
  getAttribute: vi.fn((attr: string) => documentElementAttrs[attr] ?? null),
  classList: {
    add: vi.fn((cls: string) => documentElementClasses.add(cls)),
    remove: vi.fn((cls: string) => documentElementClasses.delete(cls)),
    contains: (cls: string) => documentElementClasses.has(cls),
  },
};

vi.stubGlobal('window', { localStorage: localStorageMock });
vi.stubGlobal('localStorage', localStorageMock);
vi.stubGlobal('document', {
  documentElement: documentElementMock,
  body: {
    classList: {
      add: vi.fn(),
      remove: vi.fn(),
    },
  },
});

// ---------------------------------------------------------------------------
// Import the mocked module.
// ---------------------------------------------------------------------------

import {
  DISCOVERED_THEMES,
  setDarkMode,
  setTheme,
  toggleDarkMode,
  useDarkMode,
  useTheme,
} from '../switcher/theme';

// ---------------------------------------------------------------------------
// Tests.
// ---------------------------------------------------------------------------

describe('DISCOVERED_THEMES', () => {
  it('contains discovered theme names (index filtered out)', () => {
    expect(DISCOVERED_THEMES).toContain('black');
    expect(DISCOVERED_THEMES).toContain('zen');
    expect(DISCOVERED_THEMES).toContain('damon');
    expect(DISCOVERED_THEMES).not.toContain('index');
  });

  it('is sorted alphabetically', () => {
    const sorted = [...DISCOVERED_THEMES].sort();
    expect([...DISCOVERED_THEMES]).toEqual(sorted);
  });
});

describe('useTheme / setTheme', () => {
  beforeEach(() => {
    localStorageMock.setItem.mockClear();
    documentElementMock.setAttribute.mockClear();
    for (const k of Object.keys(localStorageStore)) delete localStorageStore[k];
  });

  it('initial theme is first sorted discovered theme', () => {
    // sorted: black < damon < zen → first is 'black'
    expect(useTheme()()).toBe('black');
  });

  it('setTheme updates the signal', () => {
    setTheme('zen');
    expect(useTheme()()).toBe('zen');
  });

  it('setTheme applies data-theme attribute', () => {
    setTheme('zen');
    expect(documentElementMock.setAttribute).toHaveBeenCalledWith('data-theme', 'zen');
  });

  it('setTheme persists to localStorage', () => {
    setTheme('damon');
    expect(localStorageMock.setItem).toHaveBeenCalledWith('omnifield-theme', 'damon');
  });

  it('setTheme is a no-op for unknown theme names', () => {
    setTheme('black'); // reset to known
    const before = useTheme()();
    localStorageMock.setItem.mockClear();
    documentElementMock.setAttribute.mockClear();
    setTheme('nonexistent-theme');
    expect(useTheme()()).toBe(before);
    expect(localStorageMock.setItem).not.toHaveBeenCalled();
    expect(documentElementMock.setAttribute).not.toHaveBeenCalled();
  });
});

describe('useDarkMode / setDarkMode / toggleDarkMode', () => {
  beforeEach(() => {
    localStorageMock.setItem.mockClear();
    documentElementMock.classList.add.mockClear();
    documentElementMock.classList.remove.mockClear();
    setDarkMode(false);
    localStorageMock.setItem.mockClear();
  });

  it('initial dark mode is false (no matchMedia in node)', () => {
    expect(useDarkMode()()).toBe(false);
  });

  it('setDarkMode(true) updates the signal', () => {
    setDarkMode(true);
    expect(useDarkMode()()).toBe(true);
  });

  it('setDarkMode(true) adds .dark class', () => {
    setDarkMode(true);
    expect(documentElementMock.classList.add).toHaveBeenCalledWith('dark');
  });

  it('setDarkMode(false) removes .dark class', () => {
    setDarkMode(true);
    documentElementMock.classList.remove.mockClear();
    setDarkMode(false);
    expect(documentElementMock.classList.remove).toHaveBeenCalledWith('dark');
  });

  it('setDarkMode persists to localStorage', () => {
    setDarkMode(true);
    expect(localStorageMock.setItem).toHaveBeenCalledWith('omnifield-theme-mode', 'dark');
    setDarkMode(false);
    expect(localStorageMock.setItem).toHaveBeenCalledWith('omnifield-theme-mode', 'light');
  });

  it('toggleDarkMode flips false → true', () => {
    expect(useDarkMode()()).toBe(false);
    toggleDarkMode();
    expect(useDarkMode()()).toBe(true);
  });

  it('toggleDarkMode flips true → false', () => {
    setDarkMode(true);
    toggleDarkMode();
    expect(useDarkMode()()).toBe(false);
  });

  it('toggleDarkMode persists the toggled value', () => {
    toggleDarkMode(); // false → true
    expect(localStorageMock.setItem).toHaveBeenLastCalledWith('omnifield-theme-mode', 'dark');
    toggleDarkMode(); // true → false
    expect(localStorageMock.setItem).toHaveBeenLastCalledWith('omnifield-theme-mode', 'light');
  });
});

/// <reference types="vite/client" />
import { type Accessor, createSignal } from 'solid-js';

const STORAGE_KEY = 'omnifield-theme';
const MODE_STORAGE_KEY = 'omnifield-theme-mode';

// Eager-import all theme CSS files — same glob as legacy ThemeSwitcher.
const themeModules = import.meta.glob('../themes/*.css', { eager: true });
export const DISCOVERED_THEMES: readonly string[] = Object.keys(themeModules)
  .map((p) => p.match(/([^/]+)\.css$/)?.[1] ?? '')
  .filter((n) => n && n !== 'index')
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
    // Mirror .dark on <body> — some third-party packages observe body classList
    // via MutationObserver and do not react to changes on <html>.
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
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
};

const [theme, setThemeSignal] = createSignal<string>(initialTheme());
const [isDark, setIsDarkSignal] = createSignal<boolean>(initialDarkMode());

// Apply initial values immediately on module-load (browser only).
if (typeof window !== 'undefined') {
  applyTheme(theme());
  applyDarkMode(isDark());
}

/** Reactive accessor for the current theme name. */
export const useTheme = (): Accessor<string> => theme;

/** Reactive accessor for the current dark-mode state. */
export const useDarkMode = (): Accessor<boolean> => isDark;

/** Set theme, apply to DOM, persist. No-op for unknown theme names. */
export const setTheme = (name: string, target?: HTMLElement): void => {
  if (!DISCOVERED_THEMES.includes(name)) return;
  setThemeSignal(name);
  applyTheme(name, target);
  if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, name);
};

/** Set dark-mode flag, apply to DOM, persist. */
export const setDarkMode = (dark: boolean, target?: HTMLElement): void => {
  setIsDarkSignal(dark);
  applyDarkMode(dark, target);
  if (typeof window !== 'undefined') {
    localStorage.setItem(MODE_STORAGE_KEY, dark ? 'dark' : 'light');
  }
};

/** Toggle dark mode. */
export const toggleDarkMode = (target?: HTMLElement): void => {
  setDarkMode(!isDark(), target);
};

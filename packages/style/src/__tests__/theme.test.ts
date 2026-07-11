/* @vitest-environment jsdom */
import { afterEach, describe, expect, it } from 'vitest';
import { createThemeController, registerTheme } from '../theme';
import { DEFAULT_DARK, DEFAULT_LIGHT } from '../tokens';

afterEach(() => {
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.classList.remove('dark');
  document.body.classList.remove('dark');
  for (const el of document.querySelectorAll('style[id^="weber-theme-"]')) el.remove();
  localStorage.clear();
});

describe('registerTheme — кастомные палитры конфигом (не вшиты в пакет)', () => {
  it('инжектит [data-theme] блоки (light + dark) в head; идемпотентно по имени', () => {
    registerTheme({ name: 'ocean', light: DEFAULT_LIGHT, dark: DEFAULT_DARK });
    const el = document.getElementById('weber-theme-ocean');
    expect(el?.textContent).toContain('[data-theme="ocean"] {');
    expect(el?.textContent).toContain('[data-theme="ocean"].dark');

    registerTheme({ name: 'ocean', light: { ...DEFAULT_LIGHT, background: 'blue' } });
    expect(document.querySelectorAll('#weber-theme-ocean')).toHaveLength(1);
    expect(document.getElementById('weber-theme-ocean')?.textContent).toContain(
      '--background: blue;',
    );
  });
});

describe('createThemeController — per-instance, без module-global', () => {
  it('дефолт = zero-config: без data-theme, mode light', () => {
    const c = createThemeController({ storageKey: null });
    expect(c.theme()).toBeUndefined();
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
    expect(c.mode()).toBe('light');
  });

  it('setTheme ставит/снимает data-theme; setMode/toggleMode рулят .dark (html + body-зеркало)', () => {
    const c = createThemeController({
      storageKey: null,
      themes: [{ name: 'ocean', light: DEFAULT_LIGHT }],
    });
    c.setTheme('ocean');
    expect(document.documentElement.getAttribute('data-theme')).toBe('ocean');
    c.setTheme(undefined);
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);

    c.setMode('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.body.classList.contains('dark')).toBe(true);
    c.toggleMode();
    expect(c.mode()).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('персист в localStorage и восстановление вторым инстансом', () => {
    const a = createThemeController({ themes: [{ name: 'ocean', light: DEFAULT_LIGHT }] });
    a.setTheme('ocean');
    a.setMode('dark');
    const b = createThemeController();
    expect(b.theme()).toBe('ocean');
    expect(b.mode()).toBe('dark');
  });

  it('инстансы независимы при storageKey: null', () => {
    const a = createThemeController({ storageKey: null });
    const b = createThemeController({ storageKey: null });
    a.setMode('dark');
    expect(b.mode()).toBe('light');
  });
});

/**
 * Механика тем. Отличия от предка (fix-then-transfer):
 *  - НИКАКОГО `import.meta.glob` — темы не вшиты в пакет, приходят сверху
 *    данными (`registerTheme`);
 *  - НИКАКИХ module-global сигналов — контроллер per-instance
 *    (`createThemeController`), апп создаёт его на бутстрапе;
 *  - дефолт zero-config: `:root` = light, `.dark` = dark (themes.css);
 *    `data-theme` — только для кастомных палитр.
 * Непрофильные switcher'ы предка (dndMode/resizeMode/finishMode/settingsMode/
 * ambient) — НЕ стили, не портированы (придут со своими владельцами).
 */

import { type Accessor, createSignal } from 'solid-js';
import type { IThemeDefinition } from './tokens';
import { themeToCss } from './tokens';

const STYLE_ID_PREFIX = 'weber-theme-';

/**
 * Регистрирует кастомную палитру: инжектит CSS-блоки
 * `[data-theme="<name>"]` (+ dark-вариант) в `<head>`. Идемпотентно по имени
 * (повторная регистрация заменяет). Активация — `setTheme(name)` контроллера
 * либо атрибут `data-theme` руками.
 */
export const registerTheme = (theme: IThemeDefinition, doc?: Document): void => {
  const d = doc ?? (typeof document === 'undefined' ? undefined : document);
  if (!d) return;
  const id = `${STYLE_ID_PREFIX}${theme.name}`;
  const css = [
    themeToCss(`[data-theme="${theme.name}"]`, theme.light),
    theme.dark
      ? themeToCss(
          `[data-theme="${theme.name}"].dark, [data-theme="${theme.name}"] .dark`,
          theme.dark,
        )
      : '',
  ]
    .filter(Boolean)
    .join('\n\n');

  let el = d.getElementById(id) as HTMLStyleElement | null;
  if (!el) {
    el = d.createElement('style');
    el.id = id;
    d.head.appendChild(el);
  }
  el.textContent = css;
};

export type ThemeMode = 'light' | 'dark';

export interface IThemeControllerOptions {
  /** Кастомные палитры для регистрации на старте. */
  themes?: IThemeDefinition[];
  /** Стартовая палитра (`undefined` = дефолтная, без data-theme). */
  initialTheme?: string;
  initialMode?: ThemeMode;
  /** Ключ localStorage-персиста; `null` — не персистить. По умолчанию 'weber-theme'. */
  storageKey?: string | null;
  /** Целевой элемент (по умолчанию documentElement). */
  target?: HTMLElement;
}

export interface IThemeController {
  theme: Accessor<string | undefined>;
  /** `undefined`/имя из зарегистрированных; `undefined` = дефолтная пара. */
  setTheme(name: string | undefined): void;
  mode: Accessor<ThemeMode>;
  setMode(mode: ThemeMode): void;
  toggleMode(): void;
}

/** Per-instance контроллер темы (сигналы Solid, никаких синглтонов). */
export const createThemeController = (options: IThemeControllerOptions = {}): IThemeController => {
  const storageKey = options.storageKey === undefined ? 'weber-theme' : options.storageKey;
  const el = () =>
    options.target ?? (typeof document === 'undefined' ? undefined : document.documentElement);

  for (const t of options.themes ?? []) registerTheme(t);

  const readPersisted = (): { theme?: string; mode?: ThemeMode } => {
    if (!storageKey || typeof localStorage === 'undefined') return {};
    try {
      return JSON.parse(localStorage.getItem(storageKey) ?? '{}');
    } catch {
      return {};
    }
  };
  const persisted = readPersisted();

  const [theme, themeSignal] = createSignal<string | undefined>(
    persisted.theme ?? options.initialTheme,
  );
  const [mode, modeSignal] = createSignal<ThemeMode>(
    persisted.mode ?? options.initialMode ?? 'light',
  );

  const persist = () => {
    if (!storageKey || typeof localStorage === 'undefined') return;
    localStorage.setItem(storageKey, JSON.stringify({ theme: theme(), mode: mode() }));
  };

  const applyTheme = (name: string | undefined) => {
    const target = el();
    if (!target) return;
    if (name) target.setAttribute('data-theme', name);
    else target.removeAttribute('data-theme');
  };

  const applyMode = (m: ThemeMode) => {
    const target = el();
    if (!target) return;
    target.classList.toggle('dark', m === 'dark');
    // Зеркало на <body> — сторонние пакеты наблюдают body.classList
    // (MutationObserver) и не реагируют на <html> (грабля предка).
    if (typeof document !== 'undefined') {
      document.body?.classList.toggle('dark', m === 'dark');
    }
  };

  applyTheme(theme());
  applyMode(mode());

  return {
    theme,
    setTheme: (name) => {
      themeSignal(name);
      applyTheme(name);
      persist();
    },
    mode,
    setMode: (m) => {
      modeSignal(m);
      applyMode(m);
      persist();
    },
    toggleMode: () => {
      const next: ThemeMode = mode() === 'dark' ? 'light' : 'dark';
      modeSignal(next);
      applyMode(next);
      persist();
    },
  };
};

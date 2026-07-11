/**
 * Токен-КОНТРАКТ (канон ADR 042 предка — set FROZEN; здесь он впервые
 * оформлен типом, а не «что нашлось в CSS»). Тема = ДАННЫЕ по этому
 * контракту; дефолт — zero-config пара light/dark (`:root` + `.dark`),
 * кастомные палитры приходят сверху через `registerTheme` (решение user
 * 2026-07-12; 11 вшитых палитр предка не переносятся — контент апп-уровня).
 */

/** Цветовые токены палитры — обязательное ядро любой темы. */
export const PALETTE_TOKENS = [
  'background',
  'foreground',
  'card',
  'card-foreground',
  'popover',
  'popover-foreground',
  'primary',
  'primary-foreground',
  'secondary',
  'secondary-foreground',
  'muted',
  'muted-foreground',
  'accent',
  'accent-foreground',
  'destructive',
  'destructive-foreground',
  'border',
  'input',
  'ring',
  'chart-1',
  'chart-2',
  'chart-3',
  'chart-4',
  'chart-5',
  'sidebar',
  'sidebar-foreground',
  'sidebar-primary',
  'sidebar-primary-foreground',
  'sidebar-accent',
  'sidebar-accent-foreground',
  'sidebar-border',
  'sidebar-ring',
] as const;

/** Мета-токены темы (шрифты/радиус/тени/трекинг) — опциональны, есть fallback'и base.css. */
export const THEME_META_TOKENS = [
  'font-sans',
  'font-serif',
  'font-mono',
  'radius',
  'tracking-normal',
  'spacing',
  'shadow-2xs',
  'shadow-xs',
  'shadow-sm',
  'shadow',
  'shadow-md',
  'shadow-lg',
  'shadow-xl',
  'shadow-2xl',
] as const;

export type PaletteToken = (typeof PALETTE_TOKENS)[number];
export type ThemeMetaToken = (typeof THEME_META_TOKENS)[number];

/** Тема как данные: полное цветовое ядро + опциональная мета. */
export type IThemeTokens = Record<PaletteToken, string> & Partial<Record<ThemeMetaToken, string>>;

export interface IThemeDefinition {
  /** Имя палитры → `[data-theme="<name>"]`. */
  name: string;
  light: IThemeTokens;
  /** Без dark-варианта палитра работает только в light-режиме. */
  dark?: IThemeTokens;
}

const SHARED_META: Partial<Record<ThemeMetaToken, string>> = {
  'font-sans': 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
  'font-serif': 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif',
  'font-mono': 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  radius: '0.5rem',
  'tracking-normal': '0em',
  spacing: '0.25rem',
  // Канон-фикс порта: у «black»-темы предка все shadow-токены были выключены
  // хаком (-50px / opacity 0) — дефолт получает НОРМАЛЬНУЮ tw-шкалу теней.
  'shadow-2xs': '0 1px 2px 0px hsl(0 0% 0% / 0.03)',
  'shadow-xs': '0 1px 2px 0px hsl(0 0% 0% / 0.05)',
  'shadow-sm': '0 1px 2px 0px hsl(0 0% 0% / 0.05), 0 1px 3px 0px hsl(0 0% 0% / 0.1)',
  shadow: '0 1px 3px 0px hsl(0 0% 0% / 0.1), 0 1px 2px -1px hsl(0 0% 0% / 0.1)',
  'shadow-md': '0 4px 6px -1px hsl(0 0% 0% / 0.1), 0 2px 4px -2px hsl(0 0% 0% / 0.1)',
  'shadow-lg': '0 10px 15px -3px hsl(0 0% 0% / 0.1), 0 4px 6px -4px hsl(0 0% 0% / 0.1)',
  'shadow-xl': '0 20px 25px -5px hsl(0 0% 0% / 0.1), 0 8px 10px -6px hsl(0 0% 0% / 0.1)',
  'shadow-2xl': '0 25px 50px -12px hsl(0 0% 0% / 0.25)',
};

/** Дефолт light — нейтральная ч/б (наследие «black»-палитры предка, oklch). */
export const DEFAULT_LIGHT: IThemeTokens = {
  background: 'oklch(1 0 0)',
  foreground: 'oklch(0.2138 0.0019 286.2347)',
  card: 'oklch(1 0 0)',
  'card-foreground': 'oklch(0.2138 0.0019 286.2347)',
  popover: 'oklch(1 0 0)',
  'popover-foreground': 'oklch(0.2138 0.0019 286.2347)',
  primary: 'oklch(0.2138 0.0019 286.2347)',
  'primary-foreground': 'oklch(0.9851 0 0)',
  secondary: 'oklch(0.9702 0 0)',
  'secondary-foreground': 'oklch(0.2138 0.0019 286.2347)',
  muted: 'oklch(0.9702 0 0)',
  'muted-foreground': 'oklch(0.5555 0 0)',
  accent: 'oklch(0.9702 0 0)',
  'accent-foreground': 'oklch(0.2138 0.0019 286.2347)',
  destructive: 'oklch(0.5406 0.2164 30.0696)',
  'destructive-foreground': 'oklch(1 0 0)',
  border: 'oklch(0.9219 0 0)',
  input: 'oklch(0.9219 0 0)',
  ring: 'oklch(0.709 0 0)',
  'chart-1': 'oklch(0.762 0.121 268.8807)',
  'chart-2': 'oklch(0.5429 0.2366 268.4747)',
  'chart-3': 'oklch(0.4787 0.2656 267.596)',
  'chart-4': 'oklch(0.4303 0.2586 266.8914)',
  'chart-5': 'oklch(0.3727 0.2109 269.7479)',
  sidebar: 'oklch(0.9851 0 0)',
  'sidebar-foreground': 'oklch(0.2138 0.0019 286.2347)',
  'sidebar-primary': 'oklch(0.2138 0.0019 286.2347)',
  'sidebar-primary-foreground': 'oklch(0.9851 0 0)',
  'sidebar-accent': 'oklch(0.9702 0 0)',
  'sidebar-accent-foreground': 'oklch(0.2138 0.0019 286.2347)',
  'sidebar-border': 'oklch(0.9219 0 0)',
  'sidebar-ring': 'oklch(0.709 0 0)',
  ...SHARED_META,
};

/** Дефолт dark — инверсия нейтральной пары. */
export const DEFAULT_DARK: IThemeTokens = {
  background: 'oklch(0 0 0)',
  foreground: 'oklch(1 0 0)',
  card: 'oklch(0 0 0)',
  'card-foreground': 'oklch(1 0 0)',
  popover: 'oklch(0 0 0)',
  'popover-foreground': 'oklch(1 0 0)',
  primary: 'oklch(1 0 0)',
  'primary-foreground': 'oklch(0 0 0)',
  secondary: 'oklch(0.1776 0 0)',
  'secondary-foreground': 'oklch(1 0 0)',
  muted: 'oklch(0.1776 0 0)',
  'muted-foreground': 'oklch(0.709 0 0)',
  accent: 'oklch(0.1776 0 0)',
  'accent-foreground': 'oklch(1 0 0)',
  destructive: 'oklch(0.6491 0.2386 33.1474)',
  'destructive-foreground': 'oklch(1 0 0)',
  border: 'oklch(0.1776 0 0)',
  input: 'oklch(0.1776 0 0)',
  ring: 'oklch(0.709 0 0)',
  'chart-1': 'oklch(0.762 0.121 268.8807)',
  'chart-2': 'oklch(0.5429 0.2366 268.4747)',
  'chart-3': 'oklch(0.4787 0.2656 267.596)',
  'chart-4': 'oklch(0.4303 0.2586 266.8914)',
  'chart-5': 'oklch(0.3727 0.2109 269.7479)',
  sidebar: 'oklch(0.1448 0 0)',
  'sidebar-foreground': 'oklch(0.9851 0 0)',
  'sidebar-primary': 'oklch(0.9851 0 0)',
  'sidebar-primary-foreground': 'oklch(0.1448 0 0)',
  'sidebar-accent': 'oklch(0.1776 0 0)',
  'sidebar-accent-foreground': 'oklch(0.9851 0 0)',
  'sidebar-border': 'oklch(0.1776 0 0)',
  'sidebar-ring': 'oklch(0.709 0 0)',
  ...SHARED_META,
};

/** Сериализация темы в CSS-блок для селектора. */
export const themeToCss = (selector: string, tokens: IThemeTokens): string => {
  const lines = Object.entries(tokens)
    .map(([key, value]) => `  --${key}: ${value};`)
    .join('\n');
  return `${selector} {\n${lines}\n}`;
};

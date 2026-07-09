/**
 * Switcher state-stores и helpers. Visual widget'ы (ModeToggle / ThemePicker)
 * живут в `@omnifield/web-shell` (tier-2, ADR 032) и потребляют эти сигналы —
 * web-style не зависит от web-ui/web-shell (иначе cycle), поэтому видимые
 * компоненты переехали туда.
 *
 * Web-style оставляет только:
 *  - Reactive signal stores:
 *      `useTheme` / `useDarkMode` / `useResizeMode` / `useDndMode`
 *      `useFinishMode` / `useFinishConfig`
 *      `useAmbientConfig`
 *  - Setters / togglers:
 *      `setTheme` / `setDarkMode` / `toggleDarkMode`
 *      `setResizeMode` / `toggleResizeMode`
 *      `setDndMode` / `toggleDndMode`
 *      `setFinishMode` / `toggleFinishMode`
 *      `setFinishConfig` / `resetFinishConfig`
 *      `setAmbientGlow` / `addAmbientGlow` / `removeAmbientGlow` / `resetAmbientConfig`
 *  - DOM-apply helpers: `applyAmbient`.
 *  - `DISCOVERED_THEMES` (eager-glob по themes/).
 */

export type { IAmbientConfig, IAmbientGlow } from './ambientConfig';
export {
  addAmbientGlow,
  applyAmbient,
  DEFAULT_AMBIENT_CONFIG,
  removeAmbientGlow,
  resetAmbientConfig,
  setAmbientGlow,
  useAmbientConfig,
} from './ambientConfig';
export {
  setDndMode,
  toggleDndMode,
  useDndMode,
} from './dndMode';
export type { IFinishConfig } from './finishConfig';
export {
  DEFAULT_FINISH_CONFIG,
  resetFinishConfig,
  setFinishConfig,
  useFinishConfig,
} from './finishConfig';
export {
  setFinishMode,
  toggleFinishMode,
  useFinishMode,
} from './finishMode';
export {
  setResizeMode,
  toggleResizeMode,
  useResizeMode,
} from './resizeMode';
export {
  setSettingsMode,
  toggleSettingsMode,
  useSettingsMode,
} from './settingsMode';
export {
  DISCOVERED_THEMES,
  setDarkMode,
  setTheme,
  toggleDarkMode,
  useDarkMode,
  useTheme,
} from './theme';

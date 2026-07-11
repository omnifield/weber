/**
 * Точка входа приложения (порт капсульного create/createRoot.ts, диета):
 * рендер в контейнер + опциональный data-theme (у предка тема 'black' была
 * вшита — style-coupling; здесь ставится ТОЛЬКО если задана).
 * Embed/handshake/EmitProvider/app-config предка НЕ портированы —
 * remote/query-волны привезут свои швы.
 */

import type { JSX } from 'solid-js';
import { render } from 'solid-js/web';

export interface ICreateRootOptions {
  /** DOM-узел или его id (без `#`). По умолчанию — id `'root'`. */
  container?: string | HTMLElement;
  /** Если задана — ставится на `<html data-theme>` (когда атрибута ещё нет). */
  defaultTheme?: string;
}

const DEFAULT_CONTAINER_ID = 'root';

const resolveContainer = (container: string | HTMLElement): HTMLElement => {
  if (typeof container !== 'string') return container;
  const el = document.getElementById(container);
  if (!el) {
    throw new Error(
      `[createRoot] container element #${container} not found in DOM. ` +
        `Make sure index.html has <div id="${container}"></div> or pass ` +
        `{ container: <HTMLElement> } explicitly.`,
    );
  }
  return el;
};

/** Рендерит корневой компонент; возвращает disposer (`render()` solid-js/web). */
export function createRoot(
  Component: () => JSX.Element,
  options: ICreateRootOptions = {},
): () => void {
  if (options.defaultTheme && typeof document !== 'undefined') {
    const root = document.documentElement;
    if (!root.hasAttribute('data-theme')) root.setAttribute('data-theme', options.defaultTheme);
  }
  const container = resolveContainer(options.container ?? DEFAULT_CONTAINER_ID);
  return render(Component, container);
}

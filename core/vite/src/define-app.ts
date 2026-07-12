/**
 * defineWeberApp — vite-конфиг аппа одной функцией (ADR-0002: community-
 * начинки за нашим контрактом): solid + unimport-глобалы + registry-кодген.
 * Router-plugin (@tanstack/router-plugin, file-based pages) — опция придёт
 * с router-волной; tailwind апп подключает своим плагином (осознанно —
 * версия/конфиг css-стека принадлежат аппу).
 */

import { resolve } from 'node:path';
import AutoImport from 'unplugin-auto-import/vite';
import type { UserConfig } from 'vite';
import { mergeConfig } from 'vite';
import solid from 'vite-plugin-solid';
import type { IAutoImportsOptions } from './auto-imports';
import { APP_ENGINE_ALIAS, APP_REGISTRY_ALIAS, buildAutoImports } from './auto-imports';
import { weberRegistryPlugin } from './plugin';

export interface IWeberAppOptions extends IAutoImportsOptions {
  /** Корень аппа (дефолт — cwd/vite root). */
  appRoot?: string;
  /** Доп. плагины аппа (tailwind и пр.). */
  plugins?: unknown[];
  /** Сырое слияние поверх итогового конфига. */
  override?: UserConfig;
}

export const defineWeberApp = (options: IWeberAppOptions = {}): UserConfig => {
  const appRoot = resolve(options.appRoot ?? process.cwd());
  const base: UserConfig = {
    plugins: [
      solid(),
      weberRegistryPlugin({ appRoot: options.appRoot }),
      AutoImport({
        imports: buildAutoImports(options) as never,
        // Типы глобалов — НАШ .weber/globals.d.ts (typeof import однослойных
        // registry-барелей, WebStorm-навигация); unimport = только runtime-инжект.
        dts: false,
      }),
      ...((options.plugins as never[]) ?? []),
    ],
    resolve: {
      alias: {
        [APP_ENGINE_ALIAS]: resolve(appRoot, 'src/engine'),
        [APP_REGISTRY_ALIAS]: resolve(appRoot, '.weber/registry'),
      },
      dedupe: ['solid-js', 'solid-js/web', 'solid-js/store'],
    },
  };
  return options.override ? mergeConfig(base, options.override) : base;
};

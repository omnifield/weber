/**
 * Vite-плагин реестра: полная генерация на старте + watch add/unlink —
 * новые файлы слоёв подхватываются БЕЗ ребута dev-сервера (боль №2 предка).
 */

import { resolve, sep } from 'node:path';
import type { Plugin } from 'vite';
import { LAYERS, writeRegistry } from './registry';

export interface IRegistryPluginOptions {
  /** Корень аппа (где src/ и .weber/). По умолчанию — vite root. */
  appRoot?: string;
}

export const weberRegistryPlugin = (options: IRegistryPluginOptions = {}): Plugin => {
  let appRoot = options.appRoot ?? process.cwd();

  const isLayerFile = (file: string): boolean => {
    const srcDir = resolve(appRoot, 'src') + sep;
    if (!file.startsWith(srcDir)) return false;
    const rel = file.slice(srcDir.length);
    const top = rel.split(sep)[0] as (typeof LAYERS)[number];
    return (LAYERS as readonly string[]).includes(top);
  };

  return {
    name: 'weber:registry',
    configResolved(config) {
      appRoot = options.appRoot ?? config.root;
      writeRegistry(appRoot);
    },
    configureServer(server) {
      const regenerate = (file: string) => {
        if (isLayerFile(file)) writeRegistry(appRoot);
      };
      server.watcher.on('add', regenerate);
      server.watcher.on('unlink', regenerate);
      server.watcher.on('addDir', regenerate);
      server.watcher.on('unlinkDir', regenerate);
    },
  };
};

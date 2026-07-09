import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { builtinModules } from 'node:module';
import { resolve } from 'node:path';
import { defineConfig, mergeConfig, type Plugin, type UserConfig } from 'vite';
import dts from 'vite-plugin-dts';
import solidPlugin from 'vite-plugin-solid';

export type LibRuntime = 'browser' | 'node' | 'isomorphic';

export interface IDefineLibConfigOptions {
  /** Точка входа: путь-строка или `{ name: path }` для multi-entry. */
  entry: string | Record<string, string>;
  /** Имя для lib-mode (используется в bundle metadata). */
  name: string;
  /**
   * `'browser'` (default) — client lib, `'node'` — серверный/build-time пакет,
   * `'isomorphic'` — пакет с обоими типами entry (например `@weber/core`,
   * где `./create` для браузера, а `./builder` для node).
   */
  runtime?: LibRuntime;
  /** Куда складывать билд. По умолчанию `'dist'`. */
  outDir?: string;
  /** Доп. external'ы поверх дефолтов. */
  external?: (string | RegExp)[];
  noExternal?: (string | RegExp)[];
  /** Доп. плагины. Solid + dts + tsconfig-paths уже включены. */
  plugins?: any[];
  /** Доп. resolve.alias. */
  alias?: Record<string, string>;
  /** Выключить DTS-генерацию (по умолчанию включена). */
  dts?: boolean;
  /**
   * Эмитить очищенный `package.json` в `outDir` (для clean-publish /
   * глобального линка прямо из `dist/`). По умолчанию `true`.
   */
  emitPackageJson?: boolean;
  /**
   * Список строк или регулярных выражений, которые нужно ИСКЛЮЧИТЬ из списков external.
   * Пакеты, попавшие сюда, будут вшиты (забандлены) прямо в код библиотеки.
   */
  bundleDependencies?: (string | RegExp)[];
  /** Сырое слияние с финальным config'ом. */
  override?: UserConfig;
  ssr?: boolean;
}

/** Всё, что не должно вшиваться в bundle — резолвится у consumer'а. */
const BROWSER_EXTERNAL: (string | RegExp)[] = [
  /^@weber\//,
  'solid-js',
  /^solid-js\//,
  /^@solidjs\//,
  /^@tanstack\//,
  /^@kobalte\//,
  /^@motionone\//,
  /^@xstate\//,
  'xstate',
  'lucide-solid',
  'zod',
  'class-variance-authority',
  'clsx',
  'tailwind-merge',
  'solid-motionone',
  'jiti',
  'tslib',
];

/**
 * Дополнительный набор externals для Node-target-пакетов.
 */
const NODE_EXTERNAL: (string | RegExp)[] = [
  ...builtinModules,
  ...builtinModules.map((m) => `node:${m}`),
  'vite',
  /^vite\//,
  /^@nx\//,
  'nx',
  /^nx\//,
  /^@swc-node\//,
  /^@swc\//,
  /^@babel\//,
  'ts-morph',
  'tailwindcss',
  '@tailwindcss/vite',
  /^@tailwindcss\/oxide/,
  'unplugin-auto-import',
  'chalk',
  'commander',
  'ora',
  'enquirer',
  'inquirer',
  'execa',
  'conf',
  'es-toolkit',
  'fsevents',
];

/**
 * Преобразует root-package.json в форму, пригодную для записи в `dist/package.json`.
 * Чистая функция — выделена ради тестируемости (см. `__tests__/libConfig.test.ts`).
 *
 * Что делает:
 *  - удаляет dev-only поля (`scripts`, `devDependencies`, `files`, `publishConfig`);
 *  - удаляет `exports` — Node всё равно игнорирует nested-exports (только root
 *    package.json'у этот ключ важен), а наличие здесь ловит publint-warning о
 *    «inconsistent resolution для некоторых бандлеров». См. cleanup-plan S-3;
 *  - переписывает `main`/`module`/`types`/`typings` со срезанием `./<outDir>/` префикса,
 *    т.к. они теперь относительны к `dist/`, а не к корню пакета.
 */
export const cleanRootPkgForDist = (
  pkg: Record<string, unknown>,
  outDir: string,
): Record<string, unknown> => {
  const stripOutDir = (p: string): string => {
    const prefix = `./${outDir}/`;
    if (p.startsWith(prefix)) return `./${p.slice(prefix.length)}`;
    if (p === `./${outDir}`) return '.';
    return p;
  };

  const next: Record<string, unknown> = { ...pkg };
  for (const key of ['scripts', 'devDependencies', 'files', 'publishConfig', 'exports'] as const) {
    delete next[key];
  }
  for (const key of ['main', 'module', 'types', 'typings'] as const) {
    if (typeof next[key] === 'string') next[key] = stripOutDir(next[key] as string);
  }
  return next;
};

const emitDistPackageJsonPlugin = (outDir: string): Plugin => {
  return {
    name: 'weber:emit-dist-package-json',
    apply: 'build',
    closeBundle() {
      const rootPkgPath = resolve('package.json');
      const raw = readFileSync(rootPkgPath, 'utf8');
      const pkg = JSON.parse(raw) as Record<string, unknown>;
      const cleaned = cleanRootPkgForDist(pkg, outDir);

      const distDirPath = resolve(outDir);
      mkdirSync(distDirPath, { recursive: true });
      const distPkgPath = resolve(distDirPath, 'package.json');
      writeFileSync(distPkgPath, `${JSON.stringify(cleaned, null, 2)}\n`, 'utf8');
    },
  };
};

export const libConfig = (opts: IDefineLibConfigOptions): UserConfig => {
  const outDir = opts.outDir ?? 'dist';
  const runtime = opts.runtime ?? 'browser';
  const entry =
    typeof opts.entry === 'string'
      ? { index: resolve(opts.entry) }
      : Object.fromEntries(Object.entries(opts.entry).map(([k, v]) => [k, resolve(v)]));

  // Собираем базовый список внешних зависимостей (массив строк и регулярных выражений)
  const defaultExternals =
    runtime === 'browser' ? BROWSER_EXTERNAL : [...BROWSER_EXTERNAL, ...NODE_EXTERNAL];
  const userExternals = opts.external ?? [];
  const fullExternalList = [...defaultExternals, ...userExternals];

  // Динамическая функция валидации импортов для Rollup
  const rollupExternalSelector = (
    id: string,
    _importer: string | undefined,
    _isResolved: boolean,
  ) => {
    // 1. Относительные импорты файлов самого проекта всегда пакуем внутрь
    if (id.startsWith('.') || id.startsWith('/') || id.includes(':')) {
      // Но встроенные node: модули всё равно должны оставаться внешними
      if (id.startsWith('node:')) return true;
      return false;
    }

    // 2. Всегда принудительно оставляем внешними любые нативные .node файлы, чтобы сборка не падала
    if (id.endsWith('.node')) return true;

    // 3. Проверяем, передан ли белый список на упаковку (bundleDependencies)
    if (opts.bundleDependencies && opts.bundleDependencies.length > 0) {
      const isWhitelistedForBundle = opts.bundleDependencies.some((target) => {
        if (target instanceof RegExp) return target.test(id);
        if (typeof target === 'string') {
          return id === target || id.startsWith(`${target}/`);
        }
        return false;
      });

      // Если пакет явно разрешен к упаковке — возвращаем false (НЕ делать внешним)
      if (isWhitelistedForBundle) return false;
    }

    // 4. Проверяем, входит ли текущий импорт в списки базовых externals
    const shouldBeExternal = fullExternalList.some((target) => {
      if (target instanceof RegExp) return target.test(id);
      if (typeof target === 'string') {
        return id === target || id.startsWith(`${target}/`);
      }
      return false;
    });

    return shouldBeExternal;
  };

  const base: UserConfig = defineConfig({
    plugins: [
      ...(runtime !== 'node' ? [solidPlugin()] : []),
      ...(opts.dts === false
        ? []
        : [
            dts({
              entryRoot: 'src',
              outDirs: outDir,
              pathsToAliases: false,
              include: ['src/**/*.ts', 'src/**/*.tsx'],
              tsconfigPath: existsSync(resolve('paths.config.json'))
                ? 'paths.config.json'
                : 'tsconfig.json',
              compilerOptions: { composite: false },
            }),
          ]),
      ...(opts.emitPackageJson === false ? [] : [emitDistPackageJsonPlugin(outDir)]),
      ...(opts.plugins ?? []),
    ],
    resolve: {
      alias: opts.alias ?? {},
      dedupe: ['solid-js', 'solid-js/web'],
      // Vite 8 native tsconfig paths resolution (replaces vite-tsconfig-paths plugin).
      // Reads tsconfig.json from the package root, follows extends chain.
      tsconfigPaths: true,
      conditions:
        runtime === 'browser'
          ? ['solid', 'browser', 'import', 'development']
          : runtime === 'isomorphic'
            ? ['solid', 'browser', 'node', 'import', 'development'] // Для изоморфных пакетов
            : ['node', 'import'],
    },
    optimizeDeps: {
      exclude: ['solid-js', 'solid-js/web', 'solid-js/store'],
    },
    build: {
      outDir,
      emptyOutDir: true,
      sourcemap: true,
      ssr: runtime === 'node',
      target: runtime === 'node' ? 'node18' : 'esnext',
      lib: {
        entry,
        name: opts.name,
        formats: ['es'],
      },
      rolldownOptions: {
        // Заменяем массив на умную функцию-селектор
        external: rollupExternalSelector,
        output: {
          entryFileNames: '[name].mjs',
          chunkFileNames: 'chunks/[name]-[hash].mjs',
          assetFileNames: 'assets/[name][extname]',
        },
      },
    },
  });

  return opts.override ? mergeConfig(base, opts.override) : base;
};

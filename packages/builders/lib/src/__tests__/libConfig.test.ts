import { describe, expect, it } from 'vitest';
import { cleanRootPkgForDist, libConfig } from '../libConfig';

/**
 * `libConfig()` собирает Vite UserConfig для библиотеки. Сердце — Rollup
 * `external` функция, которая решает: пакуем модуль внутрь bundle или
 * оставляем external (резолвится у consumer'а). Регрессии в этой логике
 * приводят к двум классам багов:
 *   1. Workspace-deps вшиты внутрь dist → дубликация, broken deduplication.
 *   2. Внутренние утилиты помечены external → ReferenceError у consumer'а.
 *
 * Тесты дёргают `external` напрямую через рекомендуемый Rollup-API.
 */

const baseOpts = {
  entry: 'src/index.ts',
  name: 'TestLib',
} as const;

type ExternalFn = (id: string, importer: string | undefined, isResolved: boolean) => boolean;

const getExternalFn = (opts: Parameters<typeof libConfig>[0]): ExternalFn => {
  const cfg = libConfig(opts);
  const fn = cfg.build!.rolldownOptions!.external as ExternalFn;
  expect(typeof fn).toBe('function');
  return fn;
};

describe('libConfig — external selector (browser runtime)', () => {
  const isExternal = getExternalFn(baseOpts);

  it.each([
    'solid-js',
    'solid-js/web',
    'solid-js/store',
    '@omnifield/web-core',
    '@omnifield/lib-builder',
    '@tanstack/solid-router',
    '@kobalte/core',
    '@motionone/solid',
    'xstate',
    '@xstate/solid',
    'lucide-solid',
    'zod',
    'tslib',
    'jiti',
  ])('externalizes %s (browser default)', (id) => {
    expect(isExternal(id, undefined, false)).toBe(true);
  });

  it.each(['./local-file', '../helper', '/abs/path'])('bundles relative/absolute path %s', (id) => {
    expect(isExternal(id, undefined, false)).toBe(false);
  });

  it('always externalizes node: builtins regardless of path', () => {
    expect(isExternal('node:fs', undefined, false)).toBe(true);
    expect(isExternal('node:path', undefined, false)).toBe(true);
  });

  it('externalizes .node native modules', () => {
    expect(isExternal('some-binding.node', undefined, false)).toBe(true);
  });

  it('does NOT externalize unknown bare specifier (gets bundled)', () => {
    // not in BROWSER_EXTERNAL — should bundle
    expect(isExternal('unknown-tiny-util', undefined, false)).toBe(false);
  });
});

describe('libConfig — bundleDependencies override', () => {
  it('regex whitelist forces dep to be bundled even if matches external', () => {
    const isExternal = getExternalFn({
      ...baseOpts,
      bundleDependencies: [/^@omnifield\/web-state/],
    });
    expect(isExternal('@omnifield/web-state', undefined, false)).toBe(false);
    expect(isExternal('@omnifield/web-state/some-subpath', undefined, false)).toBe(false);
    // sibling without whitelist remains external
    expect(isExternal('@omnifield/web-core', undefined, false)).toBe(true);
  });

  it('string whitelist supports exact + subpath', () => {
    const isExternal = getExternalFn({
      ...baseOpts,
      bundleDependencies: ['@omnifield/web-state'],
    });
    expect(isExternal('@omnifield/web-state', undefined, false)).toBe(false);
    expect(isExternal('@omnifield/web-state/sub', undefined, false)).toBe(false);
  });
});

describe('libConfig — user external addition', () => {
  it('user-supplied externals append to defaults', () => {
    const isExternal = getExternalFn({
      ...baseOpts,
      external: ['my-private-dep'],
    });
    expect(isExternal('my-private-dep', undefined, false)).toBe(true);
    expect(isExternal('solid-js', undefined, false)).toBe(true); // still external
  });
});

describe('libConfig — runtime variants', () => {
  it('node runtime extends externals with node-only entries', () => {
    const isExternal = getExternalFn({
      ...baseOpts,
      runtime: 'node',
    });
    expect(isExternal('vite', undefined, false)).toBe(true);
    expect(isExternal('vite/something', undefined, false)).toBe(true);
    expect(isExternal('ts-morph', undefined, false)).toBe(true);
    expect(isExternal('chalk', undefined, false)).toBe(true);
    expect(isExternal('@nx/anything', undefined, false)).toBe(true);
  });

  it('browser runtime does NOT externalize vite (would bundle if it were a runtime dep)', () => {
    const isExternal = getExternalFn(baseOpts);
    expect(isExternal('vite', undefined, false)).toBe(false);
  });

  it('node runtime sets ssr: true and node conditions', () => {
    const cfg = libConfig({ ...baseOpts, runtime: 'node' });
    expect(cfg.build?.ssr).toBe(true);
    expect(cfg.resolve?.conditions).toEqual(['node', 'import']);
  });

  it('browser runtime sets solid/browser conditions', () => {
    const cfg = libConfig({ ...baseOpts, runtime: 'browser' });
    expect(cfg.resolve?.conditions).toEqual(['solid', 'browser', 'import', 'development']);
  });

  it('isomorphic runtime conditions include both node and browser', () => {
    const cfg = libConfig({ ...baseOpts, runtime: 'isomorphic' });
    expect(cfg.resolve?.conditions).toContain('node');
    expect(cfg.resolve?.conditions).toContain('browser');
  });
});

describe('libConfig — build output shape', () => {
  it('emits .mjs files (es format only)', () => {
    const cfg = libConfig(baseOpts);
    expect(cfg.build?.lib).toMatchObject({ formats: ['es'] });
    expect(
      (cfg.build?.rolldownOptions?.output as { entryFileNames?: string })?.entryFileNames,
    ).toBe('[name].mjs');
  });

  it('keeps sourcemaps enabled', () => {
    const cfg = libConfig(baseOpts);
    expect(cfg.build?.sourcemap).toBe(true);
  });

  it('respects outDir override', () => {
    const cfg = libConfig({ ...baseOpts, outDir: 'lib' });
    expect(cfg.build?.outDir).toBe('lib');
  });

  it('default outDir = "dist"', () => {
    const cfg = libConfig(baseOpts);
    expect(cfg.build?.outDir).toBe('dist');
  });

  it('node runtime targets node18', () => {
    const cfg = libConfig({ ...baseOpts, runtime: 'node' });
    expect(cfg.build?.target).toBe('node18');
  });
});

describe('libConfig — plugin selection', () => {
  const pluginNames = (cfg: ReturnType<typeof libConfig>): string[] =>
    ((cfg.plugins ?? []) as unknown[])
      .flat(Number.POSITIVE_INFINITY)
      .filter(Boolean)
      .map((p) => (p as { name?: string }).name)
      .filter((n): n is string => Boolean(n));

  it('dts plugin is included by default', () => {
    const names = pluginNames(libConfig(baseOpts));
    expect(names).toContain('unplugin-dts');
  });

  it('dts plugin is excluded when dts: false', () => {
    const names = pluginNames(libConfig({ ...baseOpts, dts: false }));
    expect(names).not.toContain('unplugin-dts');
  });

  it('omnifield:emit-dist-package-json plugin is included by default', () => {
    const names = pluginNames(libConfig(baseOpts));
    expect(names).toContain('omnifield:emit-dist-package-json');
  });

  it('emit-dist-package-json plugin can be opted out', () => {
    const names = pluginNames(libConfig({ ...baseOpts, emitPackageJson: false }));
    expect(names).not.toContain('omnifield:emit-dist-package-json');
  });

  it('user plugins are appended', () => {
    const userPlugin = { name: 'user-marker' };
    const names = pluginNames(libConfig({ ...baseOpts, plugins: [userPlugin] }));
    expect(names).toContain('user-marker');
  });

  it('solid plugin is excluded for node runtime', () => {
    const names = pluginNames(libConfig({ ...baseOpts, runtime: 'node' }));
    expect(names.some((n) => n.includes('solid'))).toBe(false);
  });

  it('solid plugin is included for browser runtime', () => {
    const names = pluginNames(libConfig({ ...baseOpts, runtime: 'browser' }));
    expect(names.some((n) => n.includes('solid'))).toBe(true);
  });
});

describe('cleanRootPkgForDist — closure-of-S-3 regression', () => {
  const ROOT_PKG = {
    name: '@omnifield/foo',
    version: '1.0.0',
    type: 'module' as const,
    main: './dist/index.mjs',
    module: './dist/index.mjs',
    types: './dist/index.d.ts',
    typings: './dist/index.d.ts',
    scripts: { build: 'vite build', test: 'vitest run' },
    devDependencies: { vitest: '^4.0.0' },
    files: ['dist'],
    publishConfig: { access: 'public' },
    exports: {
      '.': {
        types: './dist/index.d.ts',
        import: './dist/index.mjs',
      },
      './create': {
        types: './dist/create/index.d.ts',
        import: './dist/create.mjs',
      },
    },
    dependencies: { 'solid-js': '^1.9.0' },
  };

  it('strips ./dist/ prefix from main / module / types / typings', () => {
    const out = cleanRootPkgForDist(ROOT_PKG, 'dist');
    expect(out.main).toBe('./index.mjs');
    expect(out.module).toBe('./index.mjs');
    expect(out.types).toBe('./index.d.ts');
    expect(out.typings).toBe('./index.d.ts');
  });

  it('removes dev-only fields', () => {
    const out = cleanRootPkgForDist(ROOT_PKG, 'dist');
    expect(out.scripts).toBeUndefined();
    expect(out.devDependencies).toBeUndefined();
    expect(out.files).toBeUndefined();
    expect(out.publishConfig).toBeUndefined();
  });

  // S-3: «nested exports field» — Node его игнорирует, бандлеры могут читать
  // и давать inconsistent resolution. Регрессионный тест на удаление.
  it('drops "exports" field (S-3 fix — publint warning)', () => {
    const out = cleanRootPkgForDist(ROOT_PKG, 'dist');
    expect(out.exports).toBeUndefined();
  });

  it('preserves dependencies + name + version + type', () => {
    const out = cleanRootPkgForDist(ROOT_PKG, 'dist');
    expect(out.name).toBe('@omnifield/foo');
    expect(out.version).toBe('1.0.0');
    expect(out.type).toBe('module');
    expect(out.dependencies).toEqual({ 'solid-js': '^1.9.0' });
  });

  it('does not mutate the input package object', () => {
    const snapshot = JSON.parse(JSON.stringify(ROOT_PKG));
    cleanRootPkgForDist(ROOT_PKG, 'dist');
    expect(ROOT_PKG).toEqual(snapshot);
  });

  it('handles non-default outDir (e.g. "lib")', () => {
    const pkg = { main: './lib/index.mjs', types: './lib/index.d.ts' };
    const out = cleanRootPkgForDist(pkg, 'lib');
    expect(out.main).toBe('./index.mjs');
    expect(out.types).toBe('./index.d.ts');
  });

  it('leaves main untouched if it does not start with ./<outDir>/', () => {
    const pkg = { main: './custom-build/x.mjs' };
    expect(cleanRootPkgForDist(pkg, 'dist').main).toBe('./custom-build/x.mjs');
  });
});

describe('libConfig — multi-entry support', () => {
  it('accepts a record entry shape', () => {
    const cfg = libConfig({
      ...baseOpts,
      entry: { main: 'src/index.ts', cli: 'src/cli.ts' },
    });
    const entry = cfg.build?.lib && (cfg.build.lib as { entry: Record<string, string> }).entry;
    expect(entry).toMatchObject({
      main: expect.stringContaining('index.ts'),
      cli: expect.stringContaining('cli.ts'),
    });
  });

  it('wraps string entry as { index: ... }', () => {
    const cfg = libConfig({ ...baseOpts, entry: 'src/main.ts' });
    const entry = cfg.build?.lib && (cfg.build.lib as { entry: Record<string, string> }).entry;
    expect(entry).toMatchObject({ index: expect.stringContaining('main.ts') });
  });
});

---
name: @omnifield/lib-builder
owner-agent: owner-builders
group: cli
status: pre-1.0
last-updated: 2026-05-20
---

# @omnifield/lib-builder

Zero-deps leaf пакет, предоставляющий `libConfig()` — Vite `UserConfig`-фабрику для сборки библиотек в монорепе.

## Зона ответственности

### Owns
- `packages/builders/lib/src/libConfig.ts` — вся логика: external selector, `emitDistPackageJsonPlugin`, `cleanRootPkgForDist`
- `packages/builders/lib/src/__tests__/libConfig.test.ts` — характеризационные тесты (S-3 регрессия)
- `packages/builders/lib/vite.config.mts` — self-build конфиг
- `packages/builders/lib/package.json` exports / deps

### Не трогает
- `packages/builders/vite/` — потребитель libConfig, не наш код
- Root-level `package.json`, `tsconfig.base.json`, `nx.json` (главный assistant)
- `apps/*/` (user / framework-developer scope)
- `scripts/release-local.mjs` и shared infra (главный assistant)

## Публичный API

Экспортируется через `.` entrypoint (`dist/index.mjs`):

- `libConfig(opts: IDefineLibConfigOptions): UserConfig` — главная фабрика. Собирает Vite config для lib-mode сборки: external selector, dts, solidPlugin, tsconfigPaths, emitDistPackageJson.
- `cleanRootPkgForDist(pkg, outDir): Record<string, unknown>` — чистая функция. Стрипает `scripts`/`devDependencies`/`files`/`publishConfig`/`exports`; перезаписывает `main`/`module`/`types`/`typings` без `outDir`-префикса. Выделена для тестируемости.
- `type IDefineLibConfigOptions` — публичный тип опций: `entry`, `name`, `runtime`, `outDir`, `external`, `noExternal`, `plugins`, `alias`, `dts`, `emitPackageJson`, `bundleDependencies`, `override`, `ssr`.
- `type LibRuntime` — `'browser' | 'node' | 'isomorphic'`

Это контракт. Изменение сигнатуры `libConfig` = breaking change; согласовать с главным + обновить всех consumer'ов (vite-builder, web-core, web-state, web-ui и т.д.).

## Quirks / gotchas

- **Zero-deps leaf — намеренно.** Нет зависимости от `@omnifield/compliance` или `@omnifield/vite-builder`. Если добавить — возникнет bootstrap-цикл: пакеты используют `libConfig` в своих `vite.config.mts` для собственной сборки. ADR 010.

- **`emitDistPackageJsonPlugin` стрипает `exports`.** Node игнорирует nested-`exports` в `dist/package.json`, а бандлеры дают inconsistent resolution. Регрессионный тест в `cleanRootPkgForDist — drops "exports" field (S-3 fix)`. Не возвращай поле обратно без понимания.

- **`bundleDependencies` — whitelist over external.** Логика: сначала проверяем `bundleDependencies`, если совпало — `return false` (bundle), затем полный external-список. Порядок важен: `bundleDependencies` имеет приоритет.

- **`runtime: 'node'` включает NODE_EXTERNAL** — большой список: все `builtinModules`, `vite`, `@babel/*`, `@nx/*`, `ts-morph`, CLI-утилиты. При добавлении нового build-time инструмента — добавь сюда, иначе он вошьётся в bundle.

- **`runtime: 'isomorphic'` для пакетов с обоими entrypoint'ами** (`./create` для браузера, `./builder` для node). Условия: `['solid', 'browser', 'node', 'import', 'development']`.

- **`dts` плагин использует `paths.config.json` если файл существует**, иначе `tsconfig.json`. Это важно для apps с локальными алиасами.

- **`solidPlugin()` не включается для `runtime: 'node'`** — только browser/isomorphic. Node-пакеты не содержат JSX.

## План рефакторинга / оптимизаций

- [ ] **Удалить stale строки из NODE_EXTERNAL** — `'building.ts-plugin-solid'`, `'building.ts-plugin-dts'`, `'building.ts-tsconfig-paths'` выглядят как артефакт. Проверить нужны ли. (priority: low)
- [ ] **`import { builtinModules }` — используется**, в `libConfig.ts` через `NODE_EXTERNAL`. В отличие от `appConfig.ts` — здесь это живой код, не мёртвый. Путаница была из-за `appConfig.ts` в vite-builder. (priority: low — только документирование)

## Test coverage

| Тип | Где | Что покрывает |
|---|---|---|
| Unit | `src/__tests__/libConfig.test.ts` | external selector (browser/node/isomorphic), bundleDependencies override, cleanRootPkgForDist S-3, plugin selection, build output shape, multi-entry |

Перед изменением: `pnpm --filter @omnifield/lib-builder test` должен быть green.
При изменении `rollupExternalSelector` или `cleanRootPkgForDist` — обновить тесты.
Перед release: `pnpm test:e2e:cli` обязателен.

## Cross-package dependencies

| Зона | Owner |
|---|---|
| vite-builder (потребляет libConfig) | owner-builders |
| compliance (потребляет libConfig для своей сборки) | owner-builders |
| CLI (координация релиза) | owner-cli |
| web-* пакеты (потребляют libConfig в vite.config.mts) | owner-web-* соответственно |

## Release group

- `cli` — fixed group: cli + compliance + lib-builder + shared-file-manager + vite-builder

После изменений — координировать release через главного. Bump major сигнатуры `libConfig` = синхронизация со всеми consumer'ами.

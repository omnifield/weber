---
name: @weber/biome-config
owner-agent: owner-builders
group: other
status: stable
last-updated: 2026-05-20
---

# @weber/biome-config

Shared Biome preset для всего монорепо и внешних потребителей. Config-only пакет — нет `src/`, нет `dist/`, нет build-step.

## Зона ответственности

### Owns
- `packages/builders/biome/biome.json` — единственный файл
- `packages/builders/biome/package.json` exports / files

### Не трогает
- Root-level `biome.json` — он extends этот пакет, но не наш файл
- `packages/builders/*/src/` — код других пакетов
- Root-level `package.json`, `tsconfig.base.json`, `nx.json` (главный assistant)
- `apps/*/` (user / framework-developer scope)

## Публичный API

Единственный subpath export:

- `./biome.json` → `./biome.json` — сам preset-файл

Потребляется двумя способами:
1. Root репо: `{ "extends": ["./packages/builders/biome/biome.json"] }` (путь к файлу)
2. Внешний consumer: `{ "extends": ["@weber/biome-config/biome.json"] }` (через npm)

Содержимое `biome.json`:
- `"root": false` — не root, вкладывается в extends-цепочку
- `linter.rules` — recommended + кастомные overrides (noDelete off, useArrowFunction error, noExplicitAny off, noUnusedVariables off и т.д.)
- `formatter` — 2 spaces, LF, lineWidth 100
- `javascript.formatter` — singleQuote, jsxDoubleQuote, trailingCommas all, semicolons always
- `css.parser.tailwindDirectives: true` — поддержка Tailwind v4 директив

## Quirks / gotchas

- **Config-only пакет — нет `src/`, нет `dist/`.** `package.json.files: ["biome.json"]`, `exports: { "./biome.json": "./biome.json" }`. `dev:builders` в root исключает пакет флагом `--filter "!@weber/biome-config"` — у него нет `build`/`dev` скриптов. Это норма, не баг.

- **Изменения правил → массовые форматирования в репо.** Когда меняешь правило linter/formatter — потребуется `pnpm lint:fix` по всему монорепо. Думай дважды, особенно для `formatter` (lineWidth, indentStyle) — это diff в сотнях файлов.

- **`"root": false` обязателен.** Без него biome трактует файл как root-config и игнорирует любой дальнейший extends в потребителе. Не убирай.

- **Версионируется независимо от группы `cli`.** Текущая версия `0.0.10`. В `nx.json` нет в `release.groups.cli`. Releaseится вручную главным assistant'ом при реальных изменениях preset'а. Не bump без необходимости.

- **`css.parser.tailwindDirectives: true`** — нужно для Tailwind v4, где `@theme`, `@source`, `@utility` — нестандартные CSS-директивы. Без этой опции biome ругается на unknown at-rules. Не убирай.

## План рефакторинга / оптимизаций

- [ ] **Проверить актуальность `noImportantStyles: "off"`** — отключена для совместимости с Tailwind utilities. При переходе на Tailwind v5 пересмотреть. (priority: low)

## Test coverage

| Тип | Где | Что покрывает |
|---|---|---|
| — | — | Тестов нет и не нужно — config-only файл |

Проверка работоспособности: `pnpm lint` из корня репо (использует root `biome.json` → extends этот файл).

## Cross-package dependencies

| Зона | Owner |
|---|---|
| Root biome.json | главный assistant |
| Внешние потребители (weber-test и т.д.) | сами управляют своим `biome.json` |

## Release group

- `@weber/biome-config` **НЕ входит** в группу `cli`. Версионируется независимо (own version 0.0.10).

Изменения preset'а → согласовать с главным, потому что root репо подхватит через extends автоматически.

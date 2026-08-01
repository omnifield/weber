# @omnifield/weber-biome-config

Shared [Biome](https://biomejs.dev) preset for the Weber framework — code formatter + linter config used by all `@omnifield/weber-*` packages.

## Использование

В корневом `biome.json` вашего проекта:

```json
{
  "$schema": "https://biomejs.dev",
  "extends": ["@omnifield/weber-biome-config/biome.json"]
}
```

Внутри Weber-монорепы используется filepath-extends:

```json
{
  "extends": ["./packages/builders/biome/biome.json"]
}
```

## Что внутри

- Форматтер: 2-space indent, LF line endings, single quotes (JS), trailing commas, semicolons, ширина 100.
- Линтер: recommended + tweaks (`useFragmentSyntax`, `useNodejsImportProtocol` обязательны; `useArrowFunction` ошибка; ряд `noXxx`-правил намеренно ослаблен для DX).
- Organize imports включён.

См. сам [biome.json](./biome.json).

## Связанное

- [docs/09-packages/builders.md](../../../docs/09-packages/builders.md) — общая дока по пакетам `packages/builders/*`
- [Biome configuration reference](https://biomejs.dev/reference/configuration/)

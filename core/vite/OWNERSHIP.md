# OWNERSHIP — @weber/vite

Build-infra (исполнение ADR-0002): `defineWeberApp` — vite-конфиг аппа одной
функцией. Наша уникальная часть — ТОЛЬКО конвенции (registry-кодген);
остальное — community-начинки (solid, unplugin-auto-import).

## Что делает

- **Registry barrel-кодген** (`registry.ts` + `plugin.ts`): скан `src/<layer>/`
  → `.weber/registry/**` — НАСТОЯЩИЕ ES-барели (`export { default as X } from
  '<src>'`), nested по папкам (канон предка), + тотальный `registry`-объект
  для `engine.register()`. Watch add/unlink — новые файлы без ребута
  dev-сервера (боль №2 предка). Идемпотентная запись (без изменений — ноль
  перезаписей).
- **Глобалы «без импортов» = слой доставки** (`auto-imports.ts`): unimport
  поверх настоящих модулей — обёртки из `@weber-app/engine` (алиас →
  `src/engine.ts` аппа, конвенция), реестры из `@weber-app/registry`
  (алиас → барели), хуки из `@weber/kernel`/`@weber/logic`. d.ts —
  `.weber/auto-imports.d.ts` (unplugin, атомарно). Навигация и типы честные —
  боли №1/№3 предка закрыты формой, не патчами.
- `defineWeberApp({ appRoot?, engineModule?, registryModule?, plugins?,
  override? })`: solid + registry-plugin + AutoImport + алиасы + dedupe.
  Tailwind апп подключает сам (версия css-стека принадлежит аппу);
  router-plugin (@tanstack/router-plugin, file-based) — опция router-волны.

## Конвенции аппа (verification: apps/sandbox)

`src/engine.ts` экспортирует движок + деструктурированные обёртки;
bootstrap: `engine.register(registry)` из `@weber-app/registry`.
tsconfig аппа: paths на оба алиаса, include `.weber` + ЯВНО
`.weber/auto-imports.d.ts`, `declaration:false`.

## Грабли (пойманы на sandbox)

- **unimport вставляет `from` как есть** — относительные пути ломаются от
  места использования → ТОЛЬКО алиасы (как `@capsule/registry` предка).
- **tsc не подхватывает `.weber/auto-imports.d.ts` wildcard-include'ом**
  (при том что `.ts` из той же папки видит) — явная запись в include.
- **`declaration:true` из base-tsconfig** в аппе даёт TS2742 на инференс
  обёрток из dist-чанков — аппу `declaration:false`.
- Апп ест пакет из **dist** — после правки src: build пакета, потом апп
  (память rebuild-dist).

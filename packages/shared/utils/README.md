# @omnifield/shared-utils

Curated utility surface для app-логики (Controllers, Features).

Выставляет единый namespace `Utils` — глобал через `unplugin-auto-import`.
App-код вызывает `Utils.map(arr, fn)`, `Utils.groupBy(items, key)` и т.д.,
никогда не обращаясь к нативным методам напрямую.

Базис — вся [es-toolkit](https://es-toolkit.dev/) плюс gap-филлеры для тривиальных
нативных операций (`map`, `filter`, `find`, `reduce`, `forEach`, `keys`, `values`, …),
которые es-toolkit намеренно не дублирует.

Сборка: `pnpm --filter @omnifield/shared-utils build`.

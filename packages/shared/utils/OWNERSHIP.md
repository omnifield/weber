# OWNERSHIP — @omnifield/shared-utils

**Owner-agent:** owner-shared
**Release group:** `web_base` (tag `web@{v}`)
**Private:** нет (publishConfig public)

---

## Зона ответственности

Curated утилитарный surface для app-логики (Controllers, Features).

Единственный entry `.` — namespace `Utils`, который инжектируется как глобал
через `unplugin-auto-import` (аналогично `Zod` из `@omnifield/shared-zod`).

**Цель:** app-код никогда не вызывает нативные методы напрямую (`.map`, `.filter`,
`Object.keys`, …) — только `Utils.X(...)`. Это унифицирует surface, упрощает
замену реализации и трассировку.

---

## Публичный API

### Глобал `Utils` (AutoImport)

```ts
// App-код использует как глобал без импорта:
const evens = Utils.filter(list, (x) => x % 2 === 0);
const groups = Utils.groupBy(items, (item) => item.status);
const copy = Utils.cloneDeep(original);
```

### Что внутри `Utils`

**Базис — вся es-toolkit (1.46.x):**
- Array: `chunk`, `compact`, `countBy`, `difference`, `differenceBy`, `differenceWith`, `drop`, `dropRight`, `dropWhile`, `flatten`, `flattenDeep`, `flatMap` (es-toolkit), `groupBy`, `head`, `initial`, `intersection`, `keyBy`, `last`, `orderBy`, `partition`, `sample`, `shuffle`, `sortBy`, `tail`, `take`, `union`, `uniq`, `uniqBy`, `without`, `xor`, `zip`, `zipObject` и др.
- Object: `clone`, `cloneDeep`, `findKey`, `invert`, `mapKeys`, `mapValues`, `merge`, `omit`, `omitBy`, `pick`, `pickBy`, `toMerged` и др.
- Function: `debounce`, `throttle`, `curry`, `memoize`, `once`, `partial`, `flow`, `noop`, `identity` и др.
- Math: `clamp`, `inRange`, `mean`, `median`, `random`, `range`, `round`, `sum` и др.
- Predicate: `isEqual`, `isNil`, `isNull`, `isUndefined`, `isString`, `isNumber`, `isBoolean`, `isFunction`, `isPlainObject`, `isDate` и др.
- String: `camelCase`, `capitalize`, `kebabCase`, `snakeCase`, `pascalCase`, `trim` и др.
- Promise: `delay`, `timeout`, `withTimeout`, `Mutex`, `Semaphore`.

**Gap-филлеры (тривиальные нативы, которые es-toolkit намеренно не реэкспортирует):**

| Имя | Обёртка над |
|---|---|
| `map(coll, fn)` | `Array.prototype.map` |
| `filter(coll, predicate)` | `Array.prototype.filter` |
| `find(coll, predicate)` | `Array.prototype.find` |
| `findIndex(coll, predicate)` | `Array.prototype.findIndex` |
| `reduce(coll, fn, initial)` | `Array.prototype.reduce` |
| `forEach(coll, fn)` | `Array.prototype.forEach` |
| `some(coll, predicate)` | `Array.prototype.some` |
| `every(coll, predicate)` | `Array.prototype.every` |
| `includes(coll, item, fromIndex?)` | `Array.prototype.includes` |
| `sort(coll, compareFn?)` | `[...coll].sort(...)` (не мутирует) |
| `reverse(coll)` | `[...coll].reverse()` (не мутирует) |
| `concat(...arrays)` | `[].concat(...)` |
| `slice(coll, start?, end?)` | `Array.prototype.slice` |
| `join(coll, separator?)` | `Array.prototype.join` |
| `keys(obj)` | `Object.keys` |
| `values(obj)` | `Object.values` |
| `entries(obj)` | `Object.entries` |
| `fromEntries(pairs)` | `Object.fromEntries` |
| `hasKey(obj, key)` | `Object.hasOwn` |

**Приоритет при коллизии:** при добавлении новых функций в es-toolkit с тем же
именем — es-toolkit перекрывает gap-филлер (spread es-toolkit идёт последним).

---

## Архитектурные решения

### Почему бандлим es-toolkit (не peer/dep)

`es-toolkit` стоит в `NODE_EXTERNAL` списке `lib-builder` (он используется в
build-time пакетах). `shared-utils` — browser-target пакет, consumer'у не нужно
устанавливать `es-toolkit` отдельно. `bundleDependencies: ['es-toolkit']` в
`vite.config.mts` форсирует bundle. Проверено: `dist/index.mjs` не содержит
`import from 'es-toolkit'` после сборки.

### Почему gap-филлеры перед esToolkit spread

Если es-toolkit добавит `map`/`filter` в будущей версии — её реализация
автоматически заменит gap-филлер без изменения кода пакета. Gap стоит первым,
es-toolkit-spread идёт поверх.

### `sort` и `reverse` — иммутабельность

Gap-реализации `sort` и `reverse` возвращают копии (`[...coll].sort()`) в отличие
от нативных методов, которые мутируют массив. Это намеренно — app-код не должен
мутировать state-объекты Solid.

---

## Зависимости

| Dep | Тип | Версия | Примечание |
|---|---|---|---|
| `es-toolkit` | dep (bundled) | `^1.46.0` | Бандлится в dist; consumer не устанавливает |

---

## Тесты

`src/__tests__/utils.test.ts` — юнит-тесты + smoke:
- Gap-филлеры Array: `map`, `filter`, `find`, `findIndex`, `reduce`, `forEach`, `some`, `every`, `includes`, `sort`, `reverse`, `concat`, `slice`, `join`
- Gap-филлеры Object: `keys`, `values`, `entries`, `fromEntries`, `hasKey`
- Smoke es-toolkit: `groupBy`, `uniq`, `chunk`, `cloneDeep`, `omit`, `pick`, `isEqual`, `camelCase`, `debounce`, `clamp`, `sum`, `merge`

Запуск: `pnpm --filter @omnifield/shared-utils test`

---

## Известные грабли

1. **Коллизия имён с es-toolkit.** Если es-toolkit добавит функцию с именем одного
   из gap-филлеров (`map`, `filter`, …) — поведение изменится (es-toolkit перекроет).
   Проверяй при апгрейде es-toolkit.

2. **`es-toolkit` в NODE_EXTERNAL.** При изменении `BROWSER_EXTERNAL` или
   `NODE_EXTERNAL` в `lib-builder` — перепроверить, не попал ли `es-toolkit` в
   `external` без `bundleDependencies`.

3. **`sort`/`reverse` иммутабельны.** Gap-реализации не мутируют исходный массив.
   Если нужна мутация — вызывай нативный метод напрямую (но в app-коде так делать
   не стоит — лучше запросить Utils.sortBy из es-toolkit).

---

## Roadmap

- [ ] Добавить `Utils` в AutoImport конфиг (зона owner-builders — `capsuleConfig.ts`)
- [ ] Smoke-тест для ESM-bundle (dist/index.mjs не содержит внешних es-toolkit импортов)
- [ ] По мере роста app-логики — расширять gap-филлерами по запросу

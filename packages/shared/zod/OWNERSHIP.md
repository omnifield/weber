# OWNERSHIP — @omnifield/shared-zod

**Owner-agent:** owner-shared
**Release group:** `web_base` (tag `web@{v}`)
**Private:** нет

---

## Зона ответственности

Два независимых subpath-entry:

1. **`.` (index)** — OmnifieldZ shim: nаmed `z` + `Zod` exports, ESM/CJS interop workaround для zod v3.
2. **`./gen`** — генератор случайных данных по Zod-схеме (faker-база + injectable ValueGenerator'ы).

---

## Публичный API

### `.` (основной entry)

```ts
import { z, Zod } from '@omnifield/shared-zod';
// z и Zod — идентичны; z — алиас для фабрик, Zod — для app-кода
// OmnifieldZ = typeof zodRoot & { component(): ZodType<JSX.Element> }
```

**CRITICAL:** не менять default export shape. Все web-* пакеты используют `import { z } from '@omnifield/shared-zod'`. Превращение `z` в default-export — breaking change для всех.

### `./gen` (subpath)

```ts
import { gen, genList, registerGenerator, unregisterGenerator } from '@omnifield/shared-zod/gen';
import type { ValueGenerator, GenFieldCtx, GenOptions } from '@omnifield/shared-zod/gen';

// Одна сущность по схеме:
gen(schema, { seed: 42 })

// Список (N элементов):
gen(z.array(schema), { seed: 42, count: 10 })
genList(schema, { seed: 42, count: 10 })  // хелпер без z.array()

// С инъекцией доменного генератора:
gen(schema, {
  seed: 42,
  generators: [{
    id: 'my-gen',
    match: (ctx) => ctx.fieldName === 'status',
    generate: (ctx) => ctx.faker.helpers.arrayElement(['open', 'closed']),
    order: -10,  // меньше = выше приоритет
  }],
})

// Глобальная регистрация (один раз при инициализации):
registerGenerator({ id, match, generate, order? })
unregisterGenerator(id)  // для тестовой изоляции
```

**Контракт `ValueGenerator`:**
```ts
interface ValueGenerator {
  id: string;
  match(ctx: GenFieldCtx): boolean;
  generate(ctx: GenFieldCtx): unknown;
  order?: number;  // default 0; меньше = выше приоритет
}
```

**Контракт `GenFieldCtx`:**
```ts
interface GenFieldCtx {
  schema: ZodTypeAny;  // текущая Zod-схема
  fieldName: string;   // leaf-имя поля (пустая строка для корня)
  path: string[];      // полный путь от корня
  faker: Faker;        // seeded инстанс (не пересоздавать)
  seed: number;
  recurse: (schema: ZodTypeAny, fieldName?: string) => unknown;
}
```

---

## Архитектурные решения

### Почему свой обход Zod-дерева (не @anatine/zod-mock / zocker)

Принято: **свой компактный обход** (~250 строк в `faker-base.ts`) поверх `@faker-js/faker`.

Причины:
1. Нужна строгая injectable-архитектура (`match`/`order`/`GenFieldCtx`) — ни одна готовая zod-mock-либа её не даёт.
2. Нужен единый seeded faker-инстанс для всего дерева — готовые либы это не гарантируют.
3. `schema._def` обход — стандартный паттерн (все zod-mock-либы делают то же внутри).
4. Размер кода невелик, поддерживаем сами в соответствии с архитектурой репо.

### Детерминизм дат

`faker.date.recent()` / `.past()` / `.future()` используют `Date.now()` как `refDate` — нестабильно между вызовами. Решение: `makeRefDate(seed)` вычисляет фиксированную Date из seed (формула: `BASE + (seed * 1_000_003) % RANGE`). Все date-генераторы получают эту `refDate`.

### faker в gen-entry, не в index

`@faker-js/faker` тяжёлый (~500kB gzip ~163kB). Бандлится только в `dist/gen.mjs`. Основной `dist/index.mjs` (0.2kB) его не тянет. Потребители, которым gen не нужен, не платят за faker.

---

## Зависимости

| Dep | Тип | Версия | Примечание |
|---|---|---|---|
| `zod` | peer | `^3.23.8` | Основа shim + gen |
| `solid-js` | peer | `^1.9.0` | Для `z.component()` → `JSX.Element` |
| `@faker-js/faker` | dep | `^9.0.0` | Только в `/gen` entry |

---

## Тесты

`src/__tests__/gen.test.ts` — 32 теста:
- Детерминизм по seed (примитив, объект, разные seeds, массив)
- Валидность (`schema.parse(gen(schema))`) для покрытых типов
- Injectable generators (match/order/path)
- Array count (`gen` + `genList`)
- `registerGenerator` / `unregisterGenerator`
- Маппинг имён полей

`src/__tests__/zod-generics.test-types.ts` — type-регрессия (OmnifieldZ generics не деградируют до `any`)

Запуск: `pnpm --filter @omnifield/shared-zod test`

---

## Известные грабли

1. `z.component()` возвращает `ZodType<JSX.Element>` — это кастомный Zod-тип без рантайм-валидации. Не использовать в `gen` (fallback → `ctx.faker.lorem.word()`).

2. `shared-utils` приватный — если нужна функция из него во внешнем пакете, экстракт сюда или в file-manager.

3. При изменении `BROWSER_EXTERNAL` в lib-builder — проверить, не попал ли `@faker-js/faker` в external (должен бандлиться в gen.mjs).

4. `Buffer.from(...).toString('base64')` в `faker-base.ts` — faker v9 убрал `string.base64()`. Работает в Node, в browser-среде `Buffer` доступен через Vite/polyfill.

---

## Roadmap

- [ ] Smoke-test для ESM/CJS interop (характеризационный, чтобы избежать silent regression)
- [ ] Маппинг имён полей расширяемый через конфиг (сейчас только инъекция через ValueGenerator)
- [ ] Мигрировать ui-creator с `rng.ts`/`wordbank.ts` на `gen` (ADR 040, не эта волна)
- [ ] Мигрировать Entity-моки в ewc/playground на `gen` (ADR 040)

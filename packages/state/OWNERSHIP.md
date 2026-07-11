# OWNERSHIP — @weber/state

Solid-native state-адаптер — ДЕФОЛТНАЯ начинка FSM/store-порта kernel'а
(ADR-0003: честный контракт кора = реактивный store + goto; XState — будущий
опциональный адаптер отдельным пакетом, первый «как-юзер» тест модульности).

## Публичный API

- `createSolidStateAdapter(): IStateAdapter` — `create(schema)` внутри Solid
  owner-скоупа → `{ stateApi, store, snapshot }`. Реализация: Solid store
  (context) + signal (current).
- `runStateAdapterConformance(label, makeAdapter)` — conformance-suite порта,
  ОБЯЗАТЕЛЬНЫЙ для любого адаптера экосистемы (ADR-0001 §конкурс).

## Контракт-детали (зеркалят ADR-0003)

- `store.ctx` = чистый user-data (state.data), без машинной обёртки.
- `update()` санитизирует payload (`unwrap` + `structuredClone`) — aliasing-
  инвариант ADR 008 предка; контракт: сериализуемые данные.
- register/unregister меняют REF `components` (coarse: onRegister фаерит);
  updateComponent/setProps — fine-grained merge; незнакомый id в
  updateComponent молча игнорируется.
- setStyles/setErrors ЗАМЕНЯЮТ карту целиком (семантика SET_* предка).
- goto на неизвестный стейт — warn + no-op.
- snapshot = `{ value, context }` (форма предка, совместимость ICtx.state).

## Квирки

- **vitest + Solid без vite-plugin-solid = SSR-сборка** (`dist/server.js`):
  реактивность no-op, тесты молча мертвы (initial run проходит, updates нет).
  Плагин в vitest.config нужен ради РЕЗОЛВА, не JSX. Та же грабля ждёт любой
  будущий адаптер — conformance это ловит (реактивные кейсы).

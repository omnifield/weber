# OWNERSHIP — @omnifield/weber-kernel

Тонкое ядро кора (ADR-0001): контракт модуля + порты + HCA runtime-контекст.
НЕ содержит механик — только то, что должно иметь ЕДИНУЮ identity у всех модулей.

## Публичный API

- `defineModule` / `IWeberModule<TApi, TConfig>` — контракт модуля кора
  (имя `weber:<name>`, `create(config) → api`). Инстансы независимы —
  module-global state в модулях запрещён.
- `IStorePort<TCtx>` / `IControllerPort` / `ICtx` — порты (`ports.ts`):
  read/write-поверхность state-шва в объёме фактического потребления модулями.
  Шаг 2 (logic-модуль) расширит FSM-стороной; первый адаптер — `@omnifield/weber-state`.
- `Context` / `useCtx` / `createUseCtx` — единый Solid-Context HCA-дерева
  (динамический резолв «ближайший Provider» у модулей работает поверх
  ОДНОЙ identity — не заводить второй Context нигде).

## Чего тут НЕТ (намеренно)

- Engine assembly (`createEngine`) — появится со вторым модулем/обёртками,
  DI на один модуль не проектируем (ADR-0001 §сборка).
- Реализаций портов — они в пакетах-адаптерах (`packages/*`).

## Квирки

- Zero-dep (peer только solid-js). Любой новый import — флажок к ревью.
- `ICtx.state` — реактивный СНАПШОТ логики, не машина (капсульная грабля P2#4).

## Тесты

`src/__tests__`: module contract (identity, независимость инстансов),
context (Provider-резолв, undefined вне Provider, shared identity createUseCtx).

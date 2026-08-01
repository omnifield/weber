# OWNERSHIP — @omnifield/weber-logic

Второй модуль кора (ADR-0001): логический слой — schema-driven dispatch,
lifecycle, программный emit, tag-запросы. Порт капсульных controller-proxy.ts +
logic-wrapper.tsx + web-state helpers/tag-registry, распиленных по ролям (ADR-0003).

## Контракт модуля

- **Вход** — `ILogicModuleConfig`: `adapter` (state-начинка по порту kernel;
  дефолт экосистемы `@omnifield/weber-state`) · `services` (состав per-kind — за сборкой:
  router/api/…; модуль о них не знает) · `compositeWrap` (связка с bindEvents
  ui-proxy — при сборке, без прямого dep между модулями) · `trace` (слот; у
  предка был жёсткий импорт web-profiler) · `aliases`.
- **Выход** — `ILogicApi`: `createController` / `createFeature` (фабрики
  обёрток) / `registerAliases`. Дескриптор: `logicModule` (`weber:logic`).
- Хуки: `useEmit` / `useEmitOptional` (программный dispatch, ADR 032 предка).

## Семантика (порт 1:1, отличия задокументированы)

Dispatch: `states[current][method]` → top-level → `next()` автобабблинг;
`next.with(arg)` → `target.from`; overrides ремапят имя. Lifecycle:
onInit/onExit по current (реактивно), onRegister на каждую РЕГИСТРАЦИЮ
(coarse-контракт порта), onDispose (onCleanup, async не ждётся), onError
(re-throw после hook'а). **Отличия от предка**: (1) `context` в хендлере =
чистый user-ctx (порт без `.data`-обёртки — CC-10); (2) tag-алиасы
ПЕР-ИНСТАНСНЫЕ (module-global запрещён ADR-0001); (3) без host-bridge/embed
(ADR 060 предка — уедет с remote-волной) и без EmitContext-sink (ADR 053 legacy).

## Store-фасад = ответ на «вагон документов» (ADR-0003)

`createStoreFacade(port, expand)`: делегация порта ГЕТТЕРАМИ (реактивность) +
удобства pick/omit/match/matchEntry/values/patch. Растёт здесь, не в порте.

## Грабля тестов/сборки

`props.children` в logic-wrapper читается ТОЛЬКО в JSX-позиции под Provider'ами
(лениво): вынос в переменную = дети инстанцируются до ctx (падает parent-цепочка).

## Тесты

controller-proxy (dispatch-резолюция, bubble, overrides, onError, goto) ·
logic-wrapper интеграция с ФЕЙК-адаптером (`__tests__/fake-adapter.ts` — модуль
тестируется против ПОРТА; deps кора в пакеты запрещены даже тестовые) ·
lifecycle · services/emit · фасад/алиасы · compositeWrap.

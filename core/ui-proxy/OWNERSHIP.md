# OWNERSHIP — @weber/ui-proxy

Первый модуль кора (эталон ADR-0001): kit-agnostic UI-прокси — навешивает
meta-opt-in event-flow (регистрация, 7 событий, дедуп bubbling, реактивные
class/name/type, patch'и логики) на ЛЮБОЙ кит компонентов.

## Контракт модуля

- **Вход** — `IUiProxyConventions` (`conventions.ts`): events (набор+updateStore),
  kindTags whitelist, tagToInputType, rawPassthroughKeys, marker-префикс.
  Дефолты = проверенный капсульный набор; кит привозит свои overrides.
- **Выход** — `IUiProxyApi`: `proxy(kit, ctx, wrapperProps)` / `wrapComponent` /
  `bindEvents` (events-only для composite-строк) / `eventMarker`.
- **Порты**: `ICtx`/`IStorePort` из `@weber/kernel` — стора модуль не знает,
  только порт. Access — инжект-слот (`access.ts`), реализацию привозит
  внешний пакет; переедет в access-модуль при его появлении.
- Дескриптор: `uiProxyModule` (`weber:ui-proxy`).

## Семантика (порт капсулы 1:1, fix-then-transfer)

Политика C (own meta opt-in) · динамический ctx-резолв (ближайший Provider,
fallback на захваченный) · kobalte raw-value путь · disabled НЕ авто-инжектится
из loading (решение 2026-05-31) · дедуп-маркер `__weber_<event>__` per-инстанс.

## Hot-path констрейнты

`create()` прекомпьютит EVENT_ENTRIES один раз; wrap — под Proxy.get.
Никаких runtime-обёрток вокруг реактивных примитивов: store.props-patch
передаётся ФУНКЦИЕЙ в mergeProps (реактивность на каждом чтении).

## Тесты = conformance-suite

`__tests__/ui-proxy.test.tsx` — семя капсульного сьюта (порт) + новые
контракт-кейсы параметризации (кастомные kindTags/events/passthrough/marker).
Любой кандидат-модуль на замену обязан проходить этот набор (ADR-0001 §конкурс).

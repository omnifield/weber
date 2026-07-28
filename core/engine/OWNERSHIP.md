# OWNERSHIP — @omnifield/weber-engine

Сборка движка (composition root кора, ADR-0001 §сборка): инстанцирует модули,
делает межмодульные связки, отдаёт обёртки слоёв. Появилась вместе с обёртками —
как и планировалось, не раньше.

## Контракт

- **Вход** — `IWeberEngineConfig`: `kit` (ЛЮБОЙ кит; Outlet/router-примитивы —
  состав кита при сборке аппа) · `adapter` (state-начинка; дефолт `@omnifield/weber-state`) ·
  `tools` (zod и пр. для Entity/Shape — приносит сборка, кор без dep на zod) ·
  `services` · `registry` · `uiProxy`-конвенции · `aliases` · `trace`.
- **Выход** — `IWeberEngine`: обёртки `Entity/View/Shape/Widget/Page/Controller/
  Feature` + `registry`/`register` + `modules` (инстансы ui-proxy/logic).
- `createRoot(Component, {container, defaultTheme?})` — рендер-вход (тема
  ставится ТОЛЬКО если задана; вшитый 'black' предка — style-coupling, убран).

## Ключевые решения

- **Реестр ПЕР-ENGINE, globalThis мёртв** (user 2026-07-12, без переходных
  шимов; предок сам планировал — A-2/A-3 его cleanup-plan). Доставка
  «без импортов» в апп-код — build-infra слой (ADR-0002): кодген генерит
  НАСТОЯЩИЙ модуль реестра, апп передаёт его в `config.registry` /
  `engine.register`. Два движка на странице изолированы полностью.
- **Связка модулей на сборке**: `compositeWrap → uiProxy.bindEvents` — прямого
  dep между logic и ui-proxy нет.
- **Сигнатуры слоёв предка сохранены**: `View((Ui, props))`,
  `Widget((Ui, store, props), options?)`, `Page((Ui, store, props))`,
  `Entity(({zod}) => def)`, `Shape(bind, config)` (two-phase ADR 036,
  path-tracker резолв через ShapeUiContext).

## Что НЕ портировано (осознанно, вернётся своими волнами)

- **Settings-strip виджета** — web-style coupling + сырые tailwind-классы В КОРЕ
  у предка (нарушение «presentation in component»); вернётся ИНЪЕКЦИЕЙ с
  kit/style-волной.
- **Embed/handshake/EmitProvider/solidBundleShim/app-config/contract**
  (~2/3 капсульного createCapsuleApp) — remote- и query-волны, свои швы.
- **Полная generics-типизация слоёв предка** (1018 строк interfaces: typed
  events, slot-типы) — slot-типизация кодген-зависима, придёт с build-infra.

## Тесты

`engine.e2e` — СМОК ИТ.1: мини-апп полного цикла (Entity→Feature→View→Widget,
клик→dispatch→update→ре-рендер) на стаб-ките + реальном solid-адаптере
(devDep @omnifield/weber-state — легитимно: сборка и есть место встречи кора с
адаптером) · изоляция двух движков · loader-swap (контент не инстанцируется
за лоадером; нюанс: loading через эффектный onInit виден после первого
рендера — timing предка тот же) · shape two-phase (tracker-резолв, overrides,
config-формы) · registry/entity.

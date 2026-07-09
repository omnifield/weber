---
name: "@omnifield/web-dnd"
owner-agent: owner-web-dnd
group: web_base
zone: runtime
status: stable
priority: P1
last-updated: 2026-06-11
---

# @omnifield/web-dnd

Pointer-based drag-and-drop для Solid.js. Лёгкий (без HTML5 native-флэйков), поддерживает mouse + touch, работает с window-level listeners (нет setPointerCapture).

## Состояние (читать ПЕРВЫМ)

- **Zone:** `runtime` — pointer DnD; используется boost-matrix + web-ui-creator + apps.
- **Status:** `stable` (0.1.1) — `DnDProvider` + `createDraggable`/`createDroppable`/`createSortable` + `DragOverlay` + `useDnD` стабильны.
- **Priority:** **P1** — основа DnD для shell/matrix + editor.
- **Maturity bar (до 1.0):**
  - autoScroll edge-cases (sticky headers).
  - Touch-specific behavior расширение.
  - DragOverlay rich-scenarios (skeleton previews).
- **Active blockers:** нет.
- **Roadmap:**
  1. autoScroll improvements (sticky headers).
  2. Touch UX.
  3. Multi-DragOverlay scenarios.
- **Last activity:** 2026-06-11 (canon refresh).

## Vendor stack (ADR 047 D3)

- **Solid.js** (`solid-js` `^1.9.12`, peerDep) — реактивный фреймворк. https://docs.solidjs.com/

Leaf-пакет zone runtime. Никаких vendor'ов кроме Solid — реализация на чистом pointer-event API.

## Зона ответственности

### Owns

- `packages/web/dnd/src/` — generic-ядро (framework-agnostic):
  - `context.tsx` — DnDProvider (activeId, pointer, droppables registry, findDroppableAt, DefaultDragOverlay)
  - `types.ts` — типы (DraggableId, DroppableId, DragData, IDraggableEntry, IDroppableEntry, IDnDProviderProps, IDragSnapshot)
  - `draggable.ts` — createDraggable (регистрация, disabled logic)
  - `droppable.ts` — createDroppable (регистрация, accepts, onDrop)
  - `sortable.ts` — createSortable (ordered-list pattern, tree-editor use)
  - `sortableZone.ts` — createSortableGroup (geometric live multi-zone sortable, ADR 025)
  - `overlay.tsx` — DragOverlay (render-prop, custom ghost)
  - `autoScroll.ts` — window-level scroll при drag близко к краю
  - `grid.ts` — pure grid-math функции (ADR 026)
  - `index.ts` — exports
- `packages/web/dnd/src/controllers/` — HCA-прослойка (ADR 032, фаза 4):
  - `index.ts` — barrel subpath'а
  - `types.ts` — IDragPayload, IDropPayload, IDroppableEmitMap, IDraggableEmitMap
  - `emitting-droppable.ts` — createEmittingDroppable (onDrop + onDragOver emit)
  - `emitting-draggable.ts` — createEmittingDraggable (onDragStart + onDragEnd emit)
- `packages/web/dnd/package.json` — deps / peerDeps / exports (включая ./controllers)
- `packages/web/dnd/vite.config.mts` — multi-entry build config (index + controllers)

### Не трогает

- Theme tokens, createStyle — owner-web-style
- Другие пакеты web_base group — делегировать соответствующим owners
- Root-level infra (package.json, tsconfig.base.json, nx.json) — главный assistant

## Публичный API

| Export | Что |
|---|---|
| `DnDProvider` | Context-провайдер с props для overlay + callbacks |
| `useDnD()` | Читать state (activeId, pointer, overId, canDrop) + startDrag |
| `createDraggable(opts)` | Делает элемент перетаскиваемым |
| `createDroppable(opts)` | Делает элемент drop-зоной |
| `createSortable(opts)` | Sortable-pattern (items с reorder, tree-editor) |
| `createSortableGroup(opts)` | Geometric live multi-zone sortable (ADR 025). Items are draggable-only; zone container is the sole droppable. Index computed geometrically from resting-position snapshots. |
| `createReorderable(opts)` | **Per-element reorder** (draggable+droppable на одном элементе + live `zone()`). Для деревьев: reorder + reparent (before/after/inside). Домен-предикаты `accepts`/`canInside` от консюмера. Вне `<DnDProvider>` — no-op. |
| `zoneFromRatio(ratioY, canInside, thresholds?)` | Pure: доля высоты → `DropZone`. leaf split 0.5; container 0.3/0.7 (override через thresholds). |
| `<DropIndicator zone={} />` | Визуал позиции вставки (before/after линия-сепаратор, inside кольцо+заливка). **Инлайн-стили на `var(--primary)`** — НЕ Tailwind (см. quirk). |
| Types: `DropZone`, `IReorderable`, `IReorderableOptions`, `IZoneThresholds` | Reorder-контракт |
| `DragOverlay` | Render-prop для кастомного ghost |
| Types: `IDnDProviderProps`, `IDraggableOptions`, `IDroppableOptions`, `DragData`, `IDropInfo`, `IDragEndResult`, `IDragSnapshot` | Основные типы |
| Types: `ISortableGroupOptions`, `ISortableGroup`, `ISortableZoneOptions`, `ISortableDropEvent`, `ISortableZone`, `ISortableZoneItem`, `IRect` | Типы для createSortableGroup |
| `ISortableZone.canAccept` | Accessor\<boolean\> — drag активен в группе И зона принимает item (pointer-position-agnostic). Для "soft-highlight всех зон" при старте drag'а. |
| `[data-dnd-cancel]` HTML convention | Потомок draggable с этим атрибутом блокирует старт drag'а. Применяется для resize handle'ов, кнопок внутри draggable-ячейки. |
| **Grid math (ADR 026 Phase 1)** | |
| `pointToCell(point, containerRect, cols, rowHeight)` | px-точка → grid-клетка {x,y} (snap + clamp). |
| `moveItem(layout, id, to, cols, compact)` | Переместить item на {x,y}, вытолкнув перекрытых соседей. |
| `resizeItem(layout, id, size, cols, compact)` | Изменить {w,h} item'а — x/y НИКОГДА не двигаются; соседи выдавливаются. |
| `placeItem(layout, item, cols, compact)` | Материализовать новый item в grid, разрешив коллизии. |
| `collides(a, b)` | True если два item'а делят хотя бы одну ячейку (edge-adjacency = false). |
| `getCollisions(layout, item)` | Все item'ы из layout, перекрывающиеся с данным. |
| `compactVertical(layout, cols)` | Подтянуть все item'ы вверх без пробелов (vertical compact strategy). |
| `clampToCols(item, cols)` | Зажать item в [0, cols): clamp x + reduce w; y/h не трогает. |
| Types: `IGridItem`, `IGridLayout` | `{id,x,y,w,h}` в grid-юнитах; `IGridLayout = IGridItem[]`. |

**Это контракт.** Изменение публичного API = breaking change для всех потребителей ([[Matrix v2|web-ui]], future composables).

### Subpath `/controllers` (ADR 032, фаза 4)

| Export | Что |
|---|---|
| `createEmittingDroppable(opts)` | droppable с инжектируемым emit. opts расширяет IDroppableOptions: `emits: { onDrop?, onDragOver? }`, `emit?: EmitFn` |
| `createEmittingDraggable(opts)` | draggable с инжектируемым emit. opts расширяет IDraggableOptions: `emits: { onDragStart?, onDragEnd? }`, `emit?: EmitFn` |
| Types: `IDragPayload`, `IDropPayload` | `{ data, pointer }` / `{ data, pointer, dropInfo }` |
| Types: `IDroppableEmitMap`, `IDraggableEmitMap` | маппинги lifecycle → HCA handler-имена |
| Type: `EmitFn` | `(eventName: string, target?: { payload?, meta? }) => unknown` — локальный тип, изоморфен `useEmit()` из web-core |

**ВАЖНО (граф зависимостей):** web-dnd стоит НИЖЕ web-core в графе (`web-core → web-ui → web-dnd`). `/controllers` НЕ зависит на web-core напрямую — это нарушило бы цикл. EmitFn инжектируется консьюмером (напр. web-ui-creator передаёт `emit: useEmit()`). Это исключение из ADR 032 ("controllers depends web-core" верно только для пакетов ВЫШЕ web-core); здесь web-dnd остаётся framework-agnostic leaf.

Если `emit` не передан — auto-emit disabled (no-op); `onDrop`-callback работает как обычно.

## Quirks / gotchas

- **No setPointerCapture** — При `setPointerCapture(pointerId)` на draggable элементе, `document.elementFromPoint(x, y)` перестаёт возвращать реальные drop-targets — всегда returns the captured element. Это ломает `findDroppableAt()` in `context.tsx:173-181`. Решение: window-level `pointermove/pointerup` listeners только (без capture). See ADR context in web-ui.

- **`[data-dnd-cancel]` opt-out vs `stopPropagation`** — Solid делегирует все события через единственный listener на `document`. `createDraggable` навешивает `pointerdown` нативно прямо на элемент. Поэтому native listener срабатывает в DOM-bubble **до** Solid-делегата — `e.stopPropagation()` на потомке не может остановить его. Решение: в `onPointerDown` проверяем `e.target.closest('[data-dnd-cancel]')` и возвращаемся **без** `preventDefault()`, так handle получает свой pointerdown в штатном режиме. Актуально для resize handle'ов и кнопок внутри draggable-ячеек (Matrix insert mode). Реализовано в `draggable.ts`.

- **Canvas WebGL limitation** — `canvas.cloneNode()` не копирует pixel buffer. Fallback: `toDataURL()` с try/catch; если tainted/CORS/`preserveDrawingBuffer=false`, выдаём slate placeholder. See `context.tsx:277-309` (DefaultDragOverlay clone logic).

- **Window-level listeners reset** — `cleanup()` вызывается при штатном завершении drag (pointerup, Escape) и при unmount Provider'а через `onCleanup(cleanup)`. Закрывает edge case: route change во время активного drag → Provider unmount раньше pointerup → orphan listeners. See `context.tsx` (cleanup function + `onCleanup(cleanup)` call).

- **Pointer in Portal** — DefaultDragOverlay рендерится в `<Portal>`, но `pointer` signal реактивный в DnDProvider. Solid细致 reactive tracking здесь work'ает правильно.

- **DropIndicator стиль — инлайн, не Tailwind (root-cause фикс «индикатор невидим»).** Консюмер-приложение сканирует Tailwind только по `src` + `web-ui` (`@source`), НЕ по web-dnd / web-studio. Arbitrary-классы (`h-[3px]`, `-top-[3px]`, `bg-primary/10`), использованные внутри пакета, НЕ попадали в билд → линия-сепаратор имела `height:auto` (визуально невидима), хотя `onDrop` отрабатывал (чистая JS-логика). Именно этот баг описан в брифе dnd-reorder-feedback-primitives §2.4. Фикс: `<DropIndicator>` рисует всё инлайн-стилями на `var(--primary)` (в weber-темах это готовый oklch-цвет) + `color-mix` для полупрозрачной заливки → самодостаточно, видимо в любом консюмере без `@source`. Тот же принцип уже был в `DefaultDragOverlay` (overlay через inline-styles). Требование к консюмеру: обёртка = `position: relative` + `overflow: visible`.

## План рефакторинга / оптимизаций

- [ ] **HTML5 Drag and Drop spec alternative** — если когда-то переходить на native DragEvent API, это будет breaking change всего пакета. Текущая реализация — намеренно простая, не привязана к spec. (priority: низкая, только если появится конкретный кейс)
- [x] **Programmatic startDrag для badge-pattern (Phase 1.2 v2, 2026-05-23)** — Matrix DragBadge вызывает `dnd.startDrag()` напрямую, cell registered as disabled draggable. Window-level listeners обрабатывают это корректно.
- [x] **DefaultDragOverlay modes: clone/thumbnail/mini (Phase 1.2 v2, 2026-05-23)** — `showDefaultOverlay` + `overlayMode` + `overlayScale`. Clone = полноразмерный полупрозрачный, thumbnail = уменьшенный centered under cursor, mini = legacy 48×48 box.
- [x] **Canvas snapshot fallback (Phase 1.2 v2, 2026-05-23)** — WebGL canvas → toDataURL(); tainted/CORS → slate placeholder.
- [x] **createSortableGroup — geometric live multi-zone sortable (ADR 025, 2026-06-01)** — Phase 1 complete. `sortableZone.ts`: items draggable-only, zone container is single droppable, insertion index computed geometrically from drag-start snapshot. Pure helpers (`computeInsertIndex`, `findZoneAtPoint`, `findNearestZone`) unit-tested (27 tests). Real geometry / UX verified in browser on Phase 3 (apps/nexus dashboard).
- [x] **Grid-canvas pure math (ADR 026 Phase 1, 2026-06-02)** — `grid.ts`: pure functions `pointToCell`/`moveItem`/`resizeItem`/`placeItem` + helpers `collides`/`getCollisions`/`compactVertical`/`clampToCols`. Types `IGridItem`/`IGridLayout`. 56 unit tests; resizeItem never-moves-self invariant formally tested. Phase 2 (render + drag in Matrix) → owner-web-ui.
- [x] **`/controllers` subpath — HCA-прослойка (ADR 032, фаза 4, 2026-06-04)** — `src/controllers/`: `createEmittingDroppable` (onDrop + onDragOver emit) + `createEmittingDraggable` (onDragStart + onDragEnd emit). Multi-entry build (vite.config.mts), package.json exports `./controllers`. 9 unit tests. tsconfig.base.json alias — запрошен у главного.
- [x] **Разрыв цикла web-dnd → web-core (2026-06-04)** — EmitFn инжектируется консьюмером через `options.emit` вместо `useEmit()` внутри. Dep `@omnifield/web-core` удалён из package.json. Цикл `web-core→web-ui→web-dnd→web-core` устранён. 102 тестов green.
- [x] **Reorder-примитивы + DropIndicator (2026-07-02, brief dnd-reorder-feedback-primitives)** — generic per-элемент reorder-фидбек перенесён из web-studio (`tree/dndHelpers.ts` + `useRowDnd.ts` + `TreeRow.tsx`-разметка). Новое: `zoneFromRatio` (pure), `createReorderable` (draggable+droppable+live `zone()`), `<DropIndicator>` (инлайн-стиль, root-cause фикс невидимости). Домен (топология дерева, манифесты) остаётся в студии предикатами `accepts`/`canInside`. 122 теста green (+20). Студия мигрирует на эти примитивы отдельно (owner-studio, §6 брифа) — contract-change координирует architect.

## Test coverage

| Тип | Где | Что покрывает |
|---|---|---|
| Stories | storybook (TBD) | visual smoke — DragOverlay modes, droppable highlighting |
| Unit | `src/__tests__/provider-cleanup.test.tsx` (5/5) | window listeners lifecycle: no listeners before drag; startDrag attaches 4; unmount during drag removes all 4; pointerup removes all 4; Escape removes all 4 |
| Unit | `src/__tests__/controllers.test.tsx` (10/10) | ADR 032: emit onDrop c { data, pointer, dropInfo }; emit onDrop + оригинальный callback; нет emit без ключа; emit onDragOver реактивно; emit onDragStart с payload; emit onDragEnd с data; нет emit для другого draggable-id; no-op без emit-fn (droppable + draggable); payload shape. EmitFn инжектируется через options — нет mock @omnifield/web-core |
| Unit | `src/__tests__/sortableZone.test.ts` (27/27) | Pure geometric helpers: `computeInsertIndex` (y/x/grid axes, empty/before/between/after/single cases); `findZoneAtPoint` (inside/outside/boundary/empty); `findNearestZone` (nearest/empty/single) |
| Unit | `src/__tests__/zone.test.ts` (8/8) | `zoneFromRatio` pure: leaf split 0.5 (пороги игнор); container 0.3/0.7 + override через thresholds |
| Unit | `src/__tests__/reorderable.test.tsx` (~10) | `createReorderable`: `zone()` реагирует на overId/pointer (leaf before/after, container inside); `accepts=false`→zone null + onDrop reject; `onDrop(data, zone)` по ratio; `disabled`→no drag; no-op вне провайдера |
| Unit | `src/__tests__/DropIndicator.test.tsx` (4/4) | smoke-рендер по зоне: before/after сепаратор (2 span, straddle края), inside кольцо (box-shadow inset), null → пусто |
| Unit | `src/__tests__/grid.test.ts` (56/56) | Pure grid-math (ADR 026 Phase 1): `collides` (overlap/adjacent/same-id); `getCollisions`; `clampToCols`; `compactVertical`; `pointToCell` (snap/clamp/offset); `moveItem` (position/neighbor-push/clamp); `resizeItem` (x/y-fixed invariant, neighbor-displaced, w-clamp, h-min); `placeItem` (insert/idempotent/overlap); formal bug-fix e2e (resize never moves self). |
| Integration | [[Matrix v2|web-ui]] swap tests | `src/primitives/layout/matrix/__tests__/swap-dnd.test.tsx` (47/47 passing) |
| E2E | `packages/cli/e2e/smoke.mjs` | косвенно через Matrix-using pages в sandbox |

**Перед изменением:** unit-tests должны быть green (`pnpm --filter @omnifield/web-dnd test`).

**Перед release:** `pnpm test:e2e:cli` smoke fixture обязателен (тестит full Matrix+DnD scenario).

## Cross-package dependencies

| Зона | Owner |
|---|---|
| UI-kit примитивы, Layout | owner-web-ui |
| Theme tokens, createStyle | owner-web-style |
| Wrapper определения (Provider) | owner-web-core (если понадобится wrapper для DnDProvider) |

## Release group

`web_base` (fixed): web-core + web-dnd + web-ui + ... (12 пакетов, релизятся вместе).

После изменений web-dnd — координировать release через главного (`pnpm release:local:web` или `--group=web_base`).

## Связанные документы

- [[016-matrix-v2-rows-engine|ADR 016]] — Matrix v2 использует swap-mode DnD
- [[web-ui|web-ui.md]] — Matrix DnD implementation details
- README.md (этой же папки) — user-facing docs

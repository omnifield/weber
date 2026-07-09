# @omnifield/web-dnd

Лёгкий drag-and-drop для Solid.js. Pointer-based (поддерживает мышь и touch без отдельных backend'ов), без HTML5 native dragenter/dragleave-флэйков.

## API

### DnDProvider props

```ts
interface IDnDProviderProps {
  children: JSX.Element;
  autoScroll?: boolean;                           // scroll window при drag у края viewport
  onDragStart?: (data: DragData, id: string) => void;
  onDragEnd?: (result: IDragEndResult) => void;
  
  // Built-in ghost (default overlay)
  showDefaultOverlay?: boolean;                   // show auto-rendered drag ghost
  overlayMode?: 'clone' | 'thumbnail' | 'mini' | 'none'; // default: 'clone'
  overlayScale?: number;                          // for 'thumbnail' mode, clamp [0.1, 1.0], default 0.4
}
```

### Low-level API

- `DnDProvider` — корневой context-провайдер, держит activeId, pointer, drop-targets.
- `useDnD()` — read state: `state.activeId()`, `state.pointer()`, `state.overId()`, `state.canDrop()` + methods.
- `createDraggable(opts)` — returns ref callback + isDragging accessor.
- `createDroppable(opts)` — returns ref callback + isOver + canDrop accessors.

### High-level patterns

- `createSortable(opts)` — sortable-список с reorder через `items`/`onReorder`.
- `DragOverlay` — render-prop component, follows cursor (for custom preview).

## Default drag overlay modes

Когда `showDefaultOverlay={true}`:

### `'clone'` (default)
Full-size полупрозрачный клон исходного элемента. Следует за курсором с offset'ом захвата (offsetX/offsetY).
- Style: `opacity: 0.6`, `scale(0.97)`
- Canvas handling: toDataURL → <img>; fallback → slate placeholder

### `'thumbnail'`
Уменьшенный клон (масштабируется по `overlayScale`, default 0.4), центрирован под курсором. Opaque с primary border + shadow.
- Style: `background: var(--card)`, `border: 2px solid primary`, `box-shadow: 0 12px 32px`
- Идеален для widgets с complex content (карты, графики)
- Canvas handling: toDataURL → <img>; fallback → slate placeholder

### `'mini'`
Legacy: маленький 48×48 indigo-box.

### `'none'`
Никакого ghost'а даже при showDefaultOverlay.

## Dataset attrs

Auto-set на HTML-элементе via `createDraggable`/`createDroppable` ref:

```ts
element.setAttribute('data-dnd-draggable', '');  // draggable
element.setAttribute('data-dnd-droppable', '');  // droppable
```

Consumers могут использовать для CSS hooks или hit-test.

## Programmatic startDrag pattern (badge-triggered)

Used by [[Matrix v2|web-ui]] DragBadge UX:

```ts
const dnd = useDnD();

// Register cell as draggable, but with disabled=true (surface doesn't trigger drag)
const cell = createDraggable({ id: `cell:${cellId}`, data: {...}, disabled: () => true });

// External UI element (badge) activates drag programmatically
<DragBadge onClick={(e) => dnd.startDrag(`cell:${cellId}`, e)} />
```

Window-level listeners handle pointermove/pointerup (no setPointerCapture — it breaks elementFromPoint for droppable hit-test).

## Canvas snapshot caveat

WebGL canvas (карты, графики) не копируют pixel buffer через `cloneNode()`. Fallback:
1. `orig.toDataURL('image/png')` → <img>
2. Если tainted/CORS/`preserveDrawingBuffer=false` → slate placeholder

Потребитель может передать `preserveDrawingBuffer: true` при инициализации WebGL context.

## Сборка

`pnpm nx build @omnifield/web-dnd`.

## Замечание

> Реализация может быть переписана позже под другой подход (HTML5 DnD spec или
> dedicated lib). Текущая API-форма — стабильный контракт; меняйте только если
> переписывается ВСЁ.

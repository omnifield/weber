/**
 * Типы для HCA-прослойки `/controllers` subpath (ADR 032, фаза 4).
 *
 * Эти типы изолированы от generic-ядра `src/index.ts` — web-core-зависимость
 * живёт только здесь.
 */

import type { DragData, IDropInfo, IPoint } from '../types';

/**
 * Payload, который кладётся в `target.payload` при любом emit из droppable/draggable.
 *
 * Структура намеренно плоская — `{ data, pointer }`:
 *  - `data` — DragData из drag-источника (что тащим)
 *  - `pointer` — координаты pointer'а в момент события (viewport-relative)
 *
 * Controller на принимающей стороне получает эти поля через стандартный
 * `target.payload` путь UiProxy/useEmit.
 */
export interface IDragPayload<T extends DragData = DragData> {
  data: T;
  pointer: IPoint;
}

/**
 * Payload для события onDrop — расширяет IDragPayload инфо о drop-таргете.
 */
export interface IDropPayload<T extends DragData = DragData> extends IDragPayload<T> {
  /** Полный IDropInfo из generic droppable (draggableId, droppableId, ratio). */
  dropInfo: IDropInfo;
}

/**
 * Маппинг lifecycle-событий droppable → HCA handler-имена.
 *
 * Ключи — фиксированные lifecycle-точки; значения — строки, которые передаются
 * в `emit(name, ...)` и должны совпадать с handler'ами целевого Controller'а.
 *
 * Все ключи опциональны: если lifecycle не нужен — просто не указываешь.
 *
 * Payload shape:
 *  - onDrop    → `IDropPayload`  (data + pointer + dropInfo)
 *  - onDragOver → `IDragPayload` (data + pointer)
 */
export interface IDroppableEmitMap {
  /** Вызывается когда draggable успешно дропнут на этот droppable. */
  onDrop?: string;
  /** Вызывается при каждом движении pointer'а над этим droppable. */
  onDragOver?: string;
}

/**
 * Маппинг lifecycle-событий draggable → HCA handler-имена.
 *
 * Payload shape:
 *  - onDragStart → `IDragPayload` (data + pointer)
 *  - onDragEnd   → `IDragPayload` (data + pointer)
 */
export interface IDraggableEmitMap {
  /** Вызывается когда drag начат (после пересечения activationDistance). */
  onDragStart?: string;
  /** Вызывается когда drag завершён (pointerup или Escape) — и drop, и cancel. */
  onDragEnd?: string;
}

import type { Accessor, JSX } from 'solid-js';

export type DraggableId = string;
export type DroppableId = string;

/**
 * Полезная нагрузка перетаскиваемого элемента. Произвольная — библиотека к
 * содержимому не привязана. Потребитель сам сужает тип в `accepts` / `onDrop`.
 */
export type DragData = Record<string, unknown>;

export interface IPoint {
  x: number;
  y: number;
}

export interface IDraggableEntry<T extends DragData = DragData> {
  id: DraggableId;
  /** Реактивный геттер — payload может меняться (e.g. имя ноды в дереве). */
  data: Accessor<T>;
  el: HTMLElement;
}

export interface IDroppableEntry<T extends DragData = DragData> {
  id: DroppableId;
  el: HTMLElement;
  /** Предикат, разрешающий или запрещающий drop конкретного draggable'а. */
  accepts: (data: T) => boolean;
  onDrop?: (data: T, info: IDropInfo) => void;
  /** Доп. данные о droppable'е (e.g. parent-id ноды в дереве) — пробрасываются в onDrop. */
  data?: T;
}

export interface IDropInfo {
  /** Источник drag'а. */
  draggableId: DraggableId;
  /** Цель drop'а. */
  droppableId: DroppableId;
  /** Координаты pointer'а в момент drop'а (viewport). */
  pointer: IPoint;
  /** Координаты pointer'а относительно droppable-элемента (0..1 нормализовано). */
  ratio: IPoint;
}

export interface IDraggableOptions<T extends DragData = DragData> {
  id: DraggableId;
  /** Реактивная функция → payload. Вызывается при каждом start drag. */
  data: Accessor<T> | T;
  /** Отключить draggable (e.g. disabled state). */
  disabled?: Accessor<boolean>;
  /**
   * Минимальное расстояние (px) от точки pointerdown до начала drag'а.
   * Переопределяет значение DnDProvider. По умолчанию берётся из провайдера (4 px).
   */
  activationDistance?: number;
}

export interface IDraggable {
  ref: (el: HTMLElement) => void;
  isDragging: Accessor<boolean>;
}

export interface IDroppableOptions<T extends DragData = DragData> {
  id: DroppableId;
  /** По умолчанию принимает всё. */
  accepts?: (data: T) => boolean;
  onDrop?: (data: T, info: IDropInfo) => void;
  /** Опциональные мета-данные droppable'а. */
  data?: T;
  disabled?: Accessor<boolean>;
}

export interface IDroppable {
  ref: (el: HTMLElement) => void;
  /** Курсор сейчас над этим droppable. */
  isOver: Accessor<boolean>;
  /** isOver && accepts(activeData) — удобный shorthand. */
  canDrop: Accessor<boolean>;
}

/** Снимок геометрии и клонированного DOM перетаскиваемого элемента. */
export interface IDragSnapshot {
  width: number;
  height: number;
  /** Deep-клон без event-listeners. Добавляется в overlay-div через ref. */
  clone: HTMLElement;
  /** Смещение pointer'а от левого верхнего угла элемента в момент захвата. */
  offsetX: number;
  offsetY: number;
}

export interface IDnDProviderProps {
  children: JSX.Element;
  /** Скроллить window когда pointer у края viewport'а. По умолчанию off. */
  autoScroll?: boolean;
  onDragStart?: (data: DragData, draggableId: DraggableId) => void;
  onDragEnd?: (result: IDragEndResult) => void;
  /**
   * Минимальное расстояние (px) от точки pointerdown, после которого drag
   * считается начавшимся. Чистый клик (pointer up до порога) не вызывает
   * startDrag/onDrop. По умолчанию 4 px.
   */
  activationDistance?: number;
  /**
   * Автоматически рендерить drag-ghost при отсутствии явного <DragOverlay>.
   * По умолчанию off.
   */
  showDefaultOverlay?: boolean;
  /**
   * Режим built-in ghost'а (работает только при `showDefaultOverlay={true}`):
   * - `'clone'`     — полноразмерный полупрозрачный клон исходного элемента (default).
   * - `'thumbnail'` — уменьшенный клон (scale по `overlayScale`), центрируется под курсором.
   *                   Без opacity — контент читается чётко. Добавляет drop-shadow + primary ring.
   * - `'mini'`      — маленький 48×48 indigo-box (legacy поведение до 9310870).
   * - `'none'`      — ghost не рендерится даже при showDefaultOverlay.
   */
  overlayMode?: 'clone' | 'thumbnail' | 'mini' | 'none';
  /**
   * Масштаб для режима `'thumbnail'`. Зажат в [0.1, 1.0]. По умолчанию 0.4.
   * Игнорируется в других режимах.
   */
  overlayScale?: number;
}

export type IDragEndResult =
  | { kind: 'drop'; data: DragData; info: IDropInfo }
  | { kind: 'cancel'; data: DragData; draggableId: DraggableId };

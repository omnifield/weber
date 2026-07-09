/**
 * `@omnifield/web-dnd/controllers` — HCA-прослойка для web-dnd (ADR 032, фаза 4).
 *
 * Экспортирует meta-aware версии `createDroppable` и `createDraggable`.
 * EmitFn инжектируется консьюмером — web-dnd НЕ зависит на web-core напрямую.
 * Консьюмер (web-ui-creator, Controller scope) передаёт `emit: useEmit()` в options.
 *
 * Generic-ядро (`@omnifield/web-dnd`) остаётся framework-agnostic.
 * Эта прослойка — opt-in: используется только внутри HCA-приложений.
 *
 * Граф зависимостей (ацикличный):
 *   web-dnd (leaf) → ничего из web_base не импортирует
 *   web-dnd/controllers → web-dnd (createDroppable, createDraggable) только
 *   Консьюмер (напр. web-ui-creator) сам тянет web-core и передаёт emit через options
 *
 * @example
 * ```ts
 * import { createEmittingDroppable, createEmittingDraggable } from '@omnifield/web-dnd/controllers';
 * import { useEmit } from '@omnifield/web-core'; // в зоне консьюмера
 *
 * // В Widget/Controller-scope:
 * const drop = createEmittingDroppable({
 *   id: 'canvas-zone',
 *   accepts: (data) => data.kind === 'component',
 *   emits: { onDrop: 'onDrop', onDragOver: 'onDragOver' },
 *   emit: useEmit(), // инжектируется здесь
 * });
 *
 * const drag = createEmittingDraggable({
 *   id: 'node-42',
 *   data: () => ({ kind: 'component', nodeId: '42' }),
 *   emits: { onDragStart: 'onDragStart', onDragEnd: 'onDragEnd' },
 *   emit: useEmit(), // инжектируется здесь
 * });
 * ```
 */

export type { IEmittingDraggableOptions } from './emitting-draggable';
export { createEmittingDraggable } from './emitting-draggable';

export type { EmitFn, IEmittingDroppableOptions } from './emitting-droppable';
export { createEmittingDroppable } from './emitting-droppable';

export type {
  IDraggableEmitMap,
  IDragPayload,
  IDropPayload,
  IDroppableEmitMap,
} from './types';

/**
 * `createEmittingDraggable` — meta-aware draggable, эмитящий HCA-события (ADR 032, фаза 4).
 *
 * Оборачивает `DnDProvider.onDragStart`/`onDragEnd` callbacks через локальную
 * регистрацию в контексте. Поскольку `createDraggable` не принимает lifecycle-callbacks
 * напрямую (они живут в `DnDProvider props`), используем подход: оборачиваем
 * создание draggable и реактивно отслеживаем `dnd.state.activeId()` для детекции
 * start/end конкретного draggable-id.
 *
 * Это намеренный design choice: один DnDProvider, несколько draggable'ов.
 * Каждый createEmittingDraggable слушает СВОЙ id — нет конфликтов.
 *
 * `EmitFn` инжектируется консьюмером — web-dnd НЕ зависит на web-core напрямую.
 * Если `emit` не передан — auto-emit disabled (no-op).
 *
 * Использование (внутри Controller/Feature scope):
 * ```ts
 * import { createEmittingDraggable } from '@omnifield/web-dnd/controllers';
 * import { useEmit } from '@omnifield/web-core'; // в zone owner's package
 *
 * const drag = createEmittingDraggable({
 *   id: 'node-42',
 *   data: () => ({ kind: 'component', nodeId: '42' }),
 *   emits: { onDragStart: 'onDragStart', onDragEnd: 'onDragEnd' },
 *   emit: useEmit(),
 * });
 * // <div ref={drag.ref} />
 * ```
 */

import { createEffect, on, untrack } from 'solid-js';
import { useDnD } from '../context';
import { createDraggable } from '../draggable';
import type { DragData, IDraggable, IDraggableOptions } from '../types';
import type { EmitFn } from './emitting-droppable';
import type { IDraggableEmitMap, IDragPayload } from './types';

export interface IEmittingDraggableOptions<T extends DragData = DragData>
  extends IDraggableOptions<T> {
  /**
   * Маппинг lifecycle → HCA handler-имена.
   * Если ключ не задан — соответствующий emit не происходит.
   */
  emits: IDraggableEmitMap;
  /**
   * Функция emit, инжектируемая консьюмером (обычно `useEmit()` из web-core).
   * Если не передана — auto-emit для всех lifecycle disabled (no-op).
   */
  emit?: EmitFn;
}

/**
 * Создаёт meta-aware draggable.
 *
 * Возвращает тот же `IDraggable` интерфейс — совместим с `createDraggable`.
 *
 * @throws если вызван вне Controller/Feature-scope (`useEmit` требует ControllerContext).
 *
 * Особенности emit'а:
 * - `onDragStart` эмитируется когда `isDragging()` переходит false → true.
 *   payload: `{ data: currentData, pointer: currentPointer }`.
 * - `onDragEnd` эмитируется когда `isDragging()` переходит true → false.
 *   payload: `{ data: lastKnownData, pointer: lastKnownPointer }`.
 *
 * Transition-эффекты отслеживаются через `createEffect(on(isDragging, handler))` —
 * `isDragging` — это `createMemo` из generic `createDraggable`, обновляется синхронно.
 */
export const createEmittingDraggable = <T extends DragData = DragData>(
  options: IEmittingDraggableOptions<T>,
): IDraggable => {
  const emit = options.emit;
  const dnd = useDnD();
  const { emits } = options;

  const draggable = createDraggable<T>(options);

  // Используем `draggable.isDragging` (createMemo из createDraggable) для отслеживания
  // lifecycle переходов. isDragging обновляется синхронно при изменении activeId.
  //
  // Gotcha: `startDrag` устанавливает setActiveId ДО setActiveData/setPointer.
  // Поэтому в onDragStart нельзя читать activeData/pointer через untrack внутри
  // effect triggered by isDragging — они ещё null. Решение: читать все три реактивно
  // в одном createEffect и ждать когда все три станут доступны.

  if (emits.onDragStart && emit) {
    const eventName = emits.onDragStart;
    const emitFn = emit;
    // Реактивно читаем isDragging + activeData + pointer. Effect сработает несколько раз
    // (при каждом изменении любого из них), но didEmitStart гарантирует один emit за drag.
    let didEmitStart = false; // один emit за drag (не при каждом pointermove)
    createEffect(() => {
      const isDragging = draggable.isDragging();
      const data = dnd.state.activeData() as T | null;
      const pointer = dnd.state.pointer();

      if (isDragging && data && pointer && !didEmitStart) {
        // Все три готовы: drag начат и данные доступны.
        didEmitStart = true;
        const payload: IDragPayload<T> = { data, pointer };
        emitFn(eventName, { payload });
      } else if (!isDragging) {
        // Drag завершён — сбрасываем флаг для следующего drag.
        didEmitStart = false;
      }
    });
  }

  if (emits.onDragEnd && emit) {
    const eventName = emits.onDragEnd;
    const emitFn = emit;
    // Snapshot данных на момент последнего активного state.
    let lastData: T | null = null;
    let lastPointer = untrack(() => dnd.state.pointer());

    // Обновляем snapshot при каждом изменении данных пока isDragging.
    // Отдельный effect чтобы не путать два разных lifecycle.
    createEffect(() => {
      if (!draggable.isDragging()) return;
      lastData = dnd.state.activeData() as T | null;
      lastPointer = dnd.state.pointer();
    });

    createEffect(
      on(
        draggable.isDragging,
        (isDragging, prevIsDragging) => {
          // true → false: drag завершён
          if (prevIsDragging && !isDragging) {
            const pointer = lastPointer ?? { x: 0, y: 0 };
            const data = lastData ?? ({} as T);
            const payload: IDragPayload<T> = { data, pointer };
            emitFn(eventName, { payload });
          }
        },
        { defer: true },
      ),
    );
  }

  return draggable;
};

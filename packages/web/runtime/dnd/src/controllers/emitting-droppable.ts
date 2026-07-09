/**
 * `createEmittingDroppable` — meta-aware droppable, эмитящий HCA-события (ADR 032, фаза 4).
 *
 * Оборачивает generic `createDroppable` из generic-ядра и добавляет emit-проводку.
 * При каждом lifecycle-событии формирует стандартный `IDragPayload` / `IDropPayload` и зовёт:
 *
 *   options.emit(emits.onDrop, { payload: { data, pointer, dropInfo } })
 *
 * `EmitFn` инжектируется консьюмером — web-dnd НЕ зависит на web-core напрямую.
 * Типичное использование в Controller/Feature scope:
 *
 * ```ts
 * import { createEmittingDroppable } from '@omnifield/web-dnd/controllers';
 * import { useEmit } from '@omnifield/web-core'; // в zone owner's package
 *
 * const drop = createEmittingDroppable({
 *   id: 'canvas-zone',
 *   accepts: (data) => data.kind === 'component',
 *   emits: { onDrop: 'onDrop', onDragOver: 'onDragOver' },
 *   emit: useEmit(),
 * });
 * // <div ref={drop.ref} />
 * ```
 *
 * Если `emit` не передан — auto-emit отключён (no-op); `onDrop`-callback работает как обычно.
 * Backward-compatible: `createEmittingDroppable({ emits:{} })` без emit — продолжает работать.
 */

import { createEffect } from 'solid-js';
import { useDnD } from '../context';
import { createDroppable } from '../droppable';
import type { DragData, IDropInfo, IDroppable, IDroppableOptions } from '../types';
import type { IDragPayload, IDropPayload, IDroppableEmitMap } from './types';

/**
 * Минимальный контракт emit-функции, инжектируемой консьюмером.
 * Намеренно изоморфен сигнатуре `useEmit()` из web-core — без прямого импорта.
 * Если emit не нужен — не передавай поле (auto-emit будет no-op).
 */
export type EmitFn = (eventName: string, target?: { payload?: unknown; meta?: unknown }) => unknown;

export interface IEmittingDroppableOptions<T extends DragData = DragData>
  extends IDroppableOptions<T> {
  /**
   * Маппинг lifecycle → HCA handler-имена.
   * Если ключ не задан — соответствующий emit не происходит.
   */
  emits: IDroppableEmitMap;
  /**
   * Функция emit, инжектируемая консьюмером (обычно `useEmit()` из web-core).
   * Если не передана — auto-emit для всех lifecycle disabled (no-op).
   * onDrop-callback продолжает работать независимо от этого поля.
   */
  emit?: EmitFn;
}

/**
 * Создаёт meta-aware droppable.
 *
 * Возвращает тот же `IDroppable` интерфейс, что `createDroppable` — совместим.
 *
 * @throws если вызван вне Controller/Feature-scope (`useEmit` требует ControllerContext).
 *
 * Особенности:
 * - `onDrop` emit срабатывает ВМЕСТО / ВМЕСТЕ с `options.onDrop`. Если app-код
 *   хочет только HCA-путь — не передавай `options.onDrop`. Если хочет оба —
 *   передавай оба; emit происходит первым.
 * - `onDragOver` emit срабатывает на каждый pointermove пока `isOver && canDrop`.
 *   Дросселинга нет — Controller должен быть идемпотентен или делать дросселинг сам.
 */
export const createEmittingDroppable = <T extends DragData = DragData>(
  options: IEmittingDroppableOptions<T>,
): IDroppable => {
  const emit = options.emit;
  const dnd = useDnD();
  const { emits } = options;

  // Оборачиваем onDrop: сначала emit (если передан), потом оригинальный callback.
  const wrappedOnDrop =
    emits.onDrop || options.onDrop
      ? (data: T, info: IDropInfo) => {
          if (emits.onDrop && emit) {
            const payload: IDropPayload<T> = {
              data,
              pointer: info.pointer,
              dropInfo: info,
            };
            emit(emits.onDrop, { payload });
          }
          options.onDrop?.(data, info);
        }
      : undefined;

  // Создаём базовый droppable с проксированным onDrop.
  const droppable = createDroppable<T>({
    ...options,
    onDrop: wrappedOnDrop,
  });

  // onDragOver: отслеживаем через реактивный `isOver` сигнал.
  // Срабатывает только если emit передан И onDragOver-ключ задан.
  if (emits.onDragOver && emit) {
    const eventName = emits.onDragOver;
    const emitFn = emit;
    createEffect(() => {
      if (!droppable.isOver()) return;
      const activeData = dnd.state.activeData() as T | null;
      const pointer = dnd.state.pointer();
      if (!activeData || !pointer) return;

      const payload: IDragPayload<T> = { data: activeData, pointer };
      emitFn(eventName, { payload });
    });
  }

  return droppable;
};

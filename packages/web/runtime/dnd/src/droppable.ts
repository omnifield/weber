import { type Accessor, createMemo, onCleanup } from 'solid-js';
import { useDnD } from './context';
import type { DragData, IDroppable, IDroppableOptions } from './types';

/**
 * Primitive для drop-цели. `ref={drop.ref}` на элементе.
 *
 * `accepts(data)` вызывается на каждом move/up для решения «можно ли сюда».
 * Возвращаемые сигналы:
 *  - `isOver` — pointer находится над этим droppable;
 *  - `canDrop` — `isOver && accepts(activeData)`.
 *
 * Если `disabled()` true, droppable считается незарегистрированным.
 */
export const createDroppable = <T extends DragData = DragData>(
  options: IDroppableOptions<T>,
): IDroppable => {
  const dnd = useDnD();
  const accepts = options.accepts ?? (() => true);
  const disabled = options.disabled ?? (() => false);

  let cleanupRegister: (() => void) | null = null;

  const ref = (el: HTMLElement) => {
    cleanupRegister?.();
    cleanupRegister = null;
    if (!el) return;
    el.dataset.dndDroppable = '';
    cleanupRegister = dnd.registerDroppable({
      id: options.id,
      el,
      accepts: accepts as (d: DragData) => boolean,
      onDrop: options.onDrop as IDroppableOptions<DragData>['onDrop'],
      data: options.data as DragData | undefined,
    });
    onCleanup(() => {
      cleanupRegister?.();
      cleanupRegister = null;
    });
  };

  const isOver: Accessor<boolean> = createMemo(
    () => !disabled() && dnd.state.overId() === options.id,
  );

  const canDrop: Accessor<boolean> = createMemo(() => {
    if (!isOver()) return false;
    const data = dnd.state.activeData() as T | null;
    if (!data) return false;
    return accepts(data);
  });

  return { ref, isOver, canDrop };
};

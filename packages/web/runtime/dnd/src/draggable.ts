import { type Accessor, createEffect, createMemo, onCleanup } from 'solid-js';
import { useDnD } from './context';
import type { DragData, IDraggable, IDraggableOptions } from './types';

const toAccessor = <T>(v: Accessor<T> | T): Accessor<T> =>
  typeof v === 'function' ? (v as Accessor<T>) : () => v;

/**
 * Primitive для draggable-источника. Применяется как `ref={drag.ref}` на
 * элементе, который должен быть перетаскиваемым.
 *
 * Старт drag'а — `pointerdown` (любая кнопка/палец). На draggable-элементе
 * проставляется `touch-action: none`, чтобы touch-drag не конфликтовал со
 * скроллом страницы.
 *
 * Текстовое выделение во время drag'а гасится глобально через `user-select:
 * none` пока `isDragging`.
 *
 * Opt-out convention: любой потомок с атрибутом `[data-dnd-cancel]` отменяет
 * старт drag'а, если `pointerdown` возник внутри него. Применяется для handle'ов
 * внутри draggable-ячейки (resize handle, кнопки), которым необходимо получить
 * собственный pointerdown без инициации drag'а. `stopPropagation()` на самом
 * handle не помогает: Solid делегирует pointerdown через единственный listener на
 * document, тогда как этот listener навешан нативно прямо на элемент — native
 * listener срабатывает раньше Solid-делегата во время DOM-bubble-фазы.
 * Аналогично маркеру `[data-dnd-draggable]` на самом draggable-элементе —
 * декларативное соглашение, не runtime-поведение.
 */
export const createDraggable = <T extends DragData = DragData>(
  options: IDraggableOptions<T>,
): IDraggable => {
  const dnd = useDnD();
  const data = toAccessor(options.data);
  const disabled = options.disabled ?? (() => false);

  let elRef: HTMLElement | null = null;

  const isDragging = createMemo(() => dnd.state.activeId() === options.id);

  // ------------------------------------------------------------------
  // Pending-drag state: populated on pointerdown, cleared on move/up.
  // We must NOT call startDrag immediately on pointerdown — a plain click
  // (pointerdown + pointerup without movement) must never trigger a drag.
  // ------------------------------------------------------------------
  let pendingOrigin: { x: number; y: number; e: PointerEvent } | null = null;

  const cancelPending = () => {
    if (!pendingOrigin) return;
    pendingOrigin = null;
    window.removeEventListener('pointermove', onPendingMove);
    window.removeEventListener('pointerup', onPendingUp);
    window.removeEventListener('pointercancel', onPendingUp);
  };

  const onPendingMove = (e: PointerEvent) => {
    if (!pendingOrigin) return;
    const dx = e.clientX - pendingOrigin.x;
    const dy = e.clientY - pendingOrigin.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const threshold = options.activationDistance ?? dnd.activationDistance;
    if (dist >= threshold) {
      // Threshold crossed → commit drag with the original pointerdown event
      // so that DnDProvider gets the correct capture-origin coordinates.
      const origin = pendingOrigin;
      cancelPending();
      dnd.startDrag(options.id, origin.e);
    }
  };

  const onPendingUp = () => {
    // Released before threshold — pure click, no drag.
    cancelPending();
  };

  const onPointerDown = (e: PointerEvent) => {
    if (disabled()) return;
    // Opt-out: a descendant marked [data-dnd-cancel] (e.g. a resize handle) must
    // not initiate a drag. Native-listener timing means the consumer's
    // stopPropagation cannot help (Solid delegates pointerdown via a single
    // document listener, while this listener is attached natively on the element —
    // the native listener fires during DOM bubble before Solid's delegated handler).
    // By NOT calling preventDefault here, the handle's own pointerdown proceeds
    // normally (e.g. initiating a resize interaction).
    const t = e.target as HTMLElement | null;
    if (t?.closest('[data-dnd-cancel]')) return;
    // Только основная кнопка (или touch — у touch button === 0)
    if (e.button !== 0) return;
    e.preventDefault();

    // Park state until movement crosses activationDistance.
    // We intentionally do NOT call startDrag here — that happens in onPendingMove
    // once the threshold is crossed. A plain click (pointerup before threshold)
    // calls cancelPending and produces no drag at all.
    pendingOrigin = { x: e.clientX, y: e.clientY, e };
    window.addEventListener('pointermove', onPendingMove);
    window.addEventListener('pointerup', onPendingUp);
    window.addEventListener('pointercancel', onPendingUp);
  };

  const ref = (el: HTMLElement) => {
    if (elRef) {
      elRef.removeEventListener('pointerdown', onPointerDown);
    }
    elRef = el;
    if (!el) return;
    el.style.touchAction = 'none';
    el.dataset.dndDraggable = '';
    el.addEventListener('pointerdown', onPointerDown);

    const unregister = dnd.registerDraggable({
      id: options.id,
      data: data as Accessor<DragData>,
      el,
    });

    onCleanup(() => {
      el.removeEventListener('pointerdown', onPointerDown);
      // If element unmounts while pointer is in the pending-activation window,
      // remove the temporary window-level listeners to prevent orphan handlers.
      cancelPending();
      unregister();
    });
  };

  // Глобальное гашение text-selection пока тянем — иначе drag по тексту
  // выделяет случайные участки.
  createEffect(() => {
    if (!isDragging()) return;
    const prev = document.body.style.userSelect;
    document.body.style.userSelect = 'none';
    onCleanup(() => {
      document.body.style.userSelect = prev;
    });
  });

  return { ref, isDragging };
};

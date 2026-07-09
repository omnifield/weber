import { type JSX, Show } from 'solid-js';
import { Portal } from 'solid-js/web';
import { useDnD } from './context';
import type { DragData } from './types';

interface IDragOverlayProps {
  /** Render-prop с текущим payload'ом перетаскиваемого элемента. */
  children: (data: DragData) => JSX.Element;
  /** Смещение preview относительно курсора (по умолчанию centered под pointer'ом). */
  offset?: { x: number; y: number };
  /**
   * Дополнительный класс для preview-обёртки. Сама обёртка — `position: fixed`
   * с `pointer-events: none`, чтобы курсор «прошивал» её и попадал в droppable.
   */
  class?: string;
}

/**
 * Призрак перетаскиваемого элемента, рендерится в `<body>` через Portal.
 * Не реагирует на pointer-events — иначе hit-testing не нашёл бы droppable
 * под курсором.
 */
export const DragOverlay = (props: IDragOverlayProps) => {
  const dnd = useDnD();
  const offX = () => props.offset?.x ?? 0;
  const offY = () => props.offset?.y ?? 0;

  return (
    <Show when={dnd.state.activeData() && dnd.state.pointer()}>
      <Portal>
        <div
          class={props.class}
          style={{
            position: 'fixed',
            left: `${(dnd.state.pointer()?.x ?? 0) + offX()}px`,
            top: `${(dnd.state.pointer()?.y ?? 0) + offY()}px`,
            'pointer-events': 'none',
            'z-index': '9999',
            transform: 'translate(-50%, -50%)',
          }}
        >
          {props.children(dnd.state.activeData()!)}
        </div>
      </Portal>
    </Show>
  );
};

import type { Accessor } from 'solid-js';
import { createDraggable } from './draggable';
import { createDroppable } from './droppable';
import type { DragData, IDropInfo } from './types';

export interface ISortableOptions<TExtra extends DragData = DragData> {
  /** Уникальный id экземпляра sortable (если их несколько). */
  id: string;
  /** Текущий порядок item-id'ов. */
  items: Accessor<string[]>;
  /** Колбэк с новым порядком после успешного reorder'а. */
  onReorder: (newOrder: string[]) => void;
  /**
   * Доп. поля в drag-data — пробрасываются вместе с системными `sortableId`,
   * `itemId`. Полезно для cross-sortable accepts-логики (например, у каждого
   * item'а есть `type`, чтобы внешний droppable знал, можно ли его принять).
   */
  extra?: (itemId: string) => TExtra;
}

export interface ISortableItem {
  ref: (el: HTMLElement) => void;
  isDragging: Accessor<boolean>;
  isOver: Accessor<boolean>;
}

interface ISortablePayload {
  /** Маркер sortable-источника. */
  __sortable: string;
  itemId: string;
  [k: string]: unknown;
}

const isSortablePayload = (d: DragData, sortableId: string): d is ISortablePayload =>
  (d as any).__sortable === sortableId && typeof (d as any).itemId === 'string';

/**
 * Лёгкая обёртка над `createDraggable + createDroppable` для упорядоченных
 * списков (например, дочерние ноды в редакторе-дереве).
 *
 * Для каждого item получается **одновременно** и draggable, и droppable.
 * Drop в верхнюю половину — вставка до target'а, в нижнюю — после.
 *
 * Sortable принимает only-свои item'ы (через `__sortable === id`). Drop из
 * палитры/иного источника нужно ловить отдельным `createDroppable` на
 * контейнере.
 */
export const createSortable = <TExtra extends DragData = DragData>(
  options: ISortableOptions<TExtra>,
) => {
  return {
    createItem: (itemId: string): ISortableItem => {
      const drag = createDraggable<ISortablePayload>({
        id: `sortable:${options.id}:${itemId}`,
        data: () => ({
          __sortable: options.id,
          itemId,
          ...(options.extra?.(itemId) ?? ({} as TExtra)),
        }),
      });

      const drop = createDroppable<ISortablePayload>({
        id: `sortable:${options.id}:${itemId}`,
        accepts: (data) => isSortablePayload(data, options.id) && data.itemId !== itemId,
        onDrop: (data, info: IDropInfo) => {
          const current = options.items();
          const fromIdx = current.indexOf(data.itemId);
          const toIdx = current.indexOf(itemId);
          if (fromIdx === -1 || toIdx === -1) return;

          // Удаляем dragged из текущего порядка
          const withoutDragged = current.filter((id) => id !== data.itemId);
          // Целевой индекс после удаления — пересчитываем
          const baseIdx = withoutDragged.indexOf(itemId);
          // Вставка до/после в зависимости от вертикальной позиции pointer'а
          const insertAt = info.ratio.y < 0.5 ? baseIdx : baseIdx + 1;

          const next = [
            ...withoutDragged.slice(0, insertAt),
            data.itemId,
            ...withoutDragged.slice(insertAt),
          ];
          options.onReorder(next);
        },
      });

      const ref = (el: HTMLElement) => {
        drag.ref(el);
        drop.ref(el);
      };

      return {
        ref,
        isDragging: drag.isDragging,
        isOver: drop.canDrop,
      };
    },
  };
};

// Хелпер для intercept-логики: подписаться на текущий activeData и проверить,
// что это item from-sortable. Удобно для зон-приёмников из других контекстов.
export const isFromSortable = (
  data: DragData | null,
  sortableId: string,
): data is ISortablePayload => !!data && isSortablePayload(data as DragData, sortableId);

/** Re-export для совместного использования с другими droppable'ами. */
export type { ISortablePayload };

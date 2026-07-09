/**
 * reorderable.ts — per-element reorder primitive (draggable + droppable + live zone).
 *
 * Один элемент одновременно **draggable** (тащим его) и **droppable** (кладём на
 * него), а `zone()` даёт живую позицию курсора относительно него —
 * `before` / `after` / `inside` — для рисования индикатора вставки.
 *
 * Отличие от `createSortable` / `createSortableGroup`: те решают flat multi-zone
 * reorder (индекс в списке). Здесь — per-элемент before/after/inside, нужный для
 * деревьев (reorder + reparent). Домен-предикаты (`accepts` — не в себя/потомка,
 * `canInside` — цель принимает ребёнка) приходят от консюмера; топологию дерева
 * / манифесты web-dnd не знает.
 *
 * Перенесено из `@omnifield/web-studio` (`tree/useRowDnd.ts`) как generic-часть.
 *
 * Требует `<DnDProvider>` выше по дереву. Вне провайдера (standalone-рендер,
 * unit-тесты) деградирует в no-op — как исходный студийный wrapper, чтобы дерево
 * рендерилось без DnD-инфры.
 */

import { type Accessor, createMemo } from 'solid-js';
import { useDnD } from './context';
import { createDraggable } from './draggable';
import { createDroppable } from './droppable';
import type { DragData } from './types';
import { type DropZone, type IZoneThresholds, zoneFromRatio } from './zone';

const toAccessor = <T>(v: Accessor<T> | T): Accessor<T> =>
  typeof v === 'function' ? (v as Accessor<T>) : () => v;

export interface IReorderableOptions<T extends DragData = DragData> {
  /** Уникальный id элемента (используется и как draggable, и как droppable id). */
  id: string;
  /** Реактивная функция → payload, либо статичный payload. */
  data: Accessor<T> | T;
  /** Отключить перетаскивание этого элемента (напр. корень дерева). */
  disabled?: Accessor<boolean>;
  /**
   * Доменный guard: можно ли класть `data` НА этот элемент вообще (напр. не в
   * себя / не в своего потомка). Дефолт — принимать всё. Гейтит и drop, и `zone()`.
   */
  accepts?: (data: T) => boolean;
  /**
   * Доменный предикат: принимает ли этот элемент `data` как ребёнка. `true` →
   * включает зону `inside`. Дефолт — `false` (только before/after).
   */
  canInside?: (data: T) => boolean;
  /** Вызывается при дропе с зоной, посчитанной по позиции курсора. */
  onDrop: (data: T, zone: DropZone) => void;
  /** Пороги container-зон (before/after доли высоты). Дефолт 0.3 / 0.7. */
  thresholds?: IZoneThresholds;
}

export interface IReorderable {
  /** Навесить на элемент: объединяет draggable.ref + droppable.ref + захват el. */
  setRef: (el: HTMLElement) => void;
  /** Этот элемент сейчас перетаскивается. */
  isDragging: Accessor<boolean>;
  /** Живая зона под курсором (для индикатора) или `null` вне ховера / невалида. */
  zone: Accessor<DropZone | null>;
}

export const createReorderable = <T extends DragData = DragData>(
  options: IReorderableOptions<T>,
): IReorderable => {
  // Вне <DnDProvider> — деградируем в no-op (standalone-рендер, unit-тесты).
  let dnd: ReturnType<typeof useDnD> | null;
  try {
    dnd = useDnD();
  } catch {
    dnd = null;
  }
  if (!dnd) {
    return { setRef: () => {}, isDragging: () => false, zone: () => null };
  }
  const ctx = dnd;

  const data = toAccessor(options.data);
  const accepts = options.accepts ?? (() => true);
  const canInside = options.canInside ?? (() => false);

  let el: HTMLElement | undefined;

  const drag = createDraggable<T>({
    id: options.id,
    data,
    disabled: options.disabled,
  });

  const drop = createDroppable<T>({
    id: options.id,
    accepts,
    onDrop: (d, info) => {
      const zone = zoneFromRatio(info.ratio.y, canInside(d), options.thresholds);
      options.onDrop(d, zone);
    },
  });

  const setRef = (node: HTMLElement) => {
    el = node;
    drag.ref(node);
    drop.ref(node);
  };

  // Живая зона: пока курсор над этим элементом (overId) и `accepts` — считаем
  // зону по live-pointer + rect. Memo — переоценивается на pointer/overId change.
  const zone = createMemo<DropZone | null>(() => {
    if (ctx.state.overId() !== options.id) return null;
    const d = ctx.state.activeData() as T | null;
    if (!d || !accepts(d)) return null;
    const p = ctx.state.pointer();
    if (!p || !el) return null;
    const r = el.getBoundingClientRect();
    if (!r.height) return null;
    return zoneFromRatio((p.y - r.top) / r.height, canInside(d), options.thresholds);
  });

  return { setRef, isDragging: drag.isDragging, zone };
};

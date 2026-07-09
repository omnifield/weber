import { type Accessor, createEffect, onCleanup } from 'solid-js';
import type { IPoint } from './types';

interface IAutoScrollConfig {
  /** Зона у края (px), внутри которой начинается скролл. */
  edge?: number;
  /** Максимальная скорость скролла (px/frame). */
  maxSpeed?: number;
}

/**
 * Скроллит окно когда указатель приближается к краю viewport'а.
 * Активируется через `<DnDProvider autoScroll>` — вне drag'а ничего не делает.
 */
export const createWindowAutoScroll = (
  pointer: Accessor<IPoint | null>,
  isActive: Accessor<boolean>,
  config: IAutoScrollConfig = {},
) => {
  const edge = config.edge ?? 50;
  const maxSpeed = config.maxSpeed ?? 15;

  const delta = (coord: number, size: number) => {
    if (coord < edge) {
      const ratio = (edge - coord) / edge;
      return -Math.ceil(ratio * maxSpeed);
    }
    if (coord > size - edge) {
      const ratio = (coord - (size - edge)) / edge;
      return Math.ceil(ratio * maxSpeed);
    }
    return 0;
  };

  createEffect(() => {
    if (!isActive()) return;
    let rafId: number | null = null;

    const tick = () => {
      const p = pointer();
      if (p) {
        const dx = delta(p.x, window.innerWidth);
        const dy = delta(p.y, window.innerHeight);
        if (dx !== 0 || dy !== 0) window.scrollBy(dx, dy);
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    onCleanup(() => {
      if (rafId !== null) cancelAnimationFrame(rafId);
    });
  });
};

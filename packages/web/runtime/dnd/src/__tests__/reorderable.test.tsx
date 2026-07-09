/**
 * Tests for createReorderable (per-element draggable + droppable + live zone).
 *
 * Strategy (mirrors controllers.test.tsx / provider-cleanup.test.tsx):
 *  - Mount inside a real <DnDProvider>; register the *source* draggable manually.
 *  - Stub document.elementFromPoint → the target node so findDroppableAt resolves
 *    to the reorderable's droppable.
 *  - Stub target.getBoundingClientRect (jsdom returns zeros) with a fixed rect so
 *    ratioY math is deterministic: top=100, height=100 → clientY 110 ⇒ 0.1, etc.
 *  - Drive state via programmatic startDrag + synthetic window pointer events.
 */
/* @vitest-environment jsdom */
import { render } from 'solid-js/web';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DnDProvider, useDnD } from '../context';
import { createReorderable } from '../reorderable';

let container: HTMLDivElement;
let origEFP: typeof document.elementFromPoint;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  origEFP = document.elementFromPoint;
});

afterEach(() => {
  if (container.parentNode) document.body.removeChild(container);
  document.elementFromPoint = origEFP;
  vi.restoreAllMocks();
});

const RECT = {
  top: 100,
  left: 0,
  right: 200,
  bottom: 200,
  width: 200,
  height: 100,
  x: 0,
  y: 100,
  toJSON() {},
} as DOMRect;

interface ISrc {
  id: string;
  [k: string]: unknown;
}

/**
 * Mount a reorderable target + a manually-registered source draggable.
 * Returns the captured dnd context, the reorderable API, and a dispose fn.
 */
function mountReorderable(opts: {
  canInside?: (d: ISrc) => boolean;
  accepts?: (d: ISrc) => boolean;
  disabled?: () => boolean;
  onDrop?: (d: ISrc, zone: string) => void;
}) {
  let capturedDnD!: ReturnType<typeof useDnD>;
  let reorderable!: ReturnType<typeof createReorderable<ISrc>>;
  let targetEl!: HTMLElement;

  const Harness = () => {
    capturedDnD = useDnD();
    // Register the source being dragged (не reorderable — просто payload-источник).
    const srcEl = document.createElement('div');
    capturedDnD.registerDraggable({
      id: 'src',
      el: srcEl,
      data: () => ({ id: 'src' }),
    });

    reorderable = createReorderable<ISrc>({
      id: 'tgt',
      data: { id: 'tgt' },
      canInside: opts.canInside,
      accepts: opts.accepts,
      disabled: opts.disabled,
      onDrop: (d, zone) => opts.onDrop?.(d, zone),
    });

    return (
      <div
        ref={(el) => {
          targetEl = el;
          el.getBoundingClientRect = () => RECT;
          reorderable.setRef(el);
        }}
        data-testid="tgt"
      />
    );
  };

  const dispose = render(
    () => (
      <DnDProvider>
        <Harness />
      </DnDProvider>
    ),
    container,
  );

  // elementFromPoint → target node so findDroppableAt resolves to 'tgt'.
  document.elementFromPoint = () => targetEl;

  return { dnd: capturedDnD, reorderable, targetEl, dispose };
}

function move(clientY: number) {
  window.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: 50, clientY }));
}

function up(clientY: number) {
  window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: 50, clientY }));
}

// ---------------------------------------------------------------------------
// zone() reactivity
// ---------------------------------------------------------------------------

describe('createReorderable — zone()', () => {
  it('null пока курсор не над целью (overId != id)', () => {
    const { dnd, reorderable, dispose } = mountReorderable({});
    dnd.startDrag('src', new PointerEvent('pointerdown', { clientX: 0, clientY: 0 }));
    // overId ещё null — pointermove не был.
    expect(reorderable.zone()).toBeNull();
    dispose();
  });

  it('leaf: верх → before, низ → after', () => {
    const { dnd, reorderable, dispose } = mountReorderable({ canInside: () => false });
    dnd.startDrag('src', new PointerEvent('pointerdown', { clientX: 0, clientY: 0 }));

    move(110); // ratioY = 0.1
    expect(reorderable.zone()).toBe('before');

    move(190); // ratioY = 0.9
    expect(reorderable.zone()).toBe('after');

    dispose();
  });

  it('container (canInside): середина → inside', () => {
    const { dnd, reorderable, dispose } = mountReorderable({ canInside: () => true });
    dnd.startDrag('src', new PointerEvent('pointerdown', { clientX: 0, clientY: 0 }));

    move(150); // ratioY = 0.5
    expect(reorderable.zone()).toBe('inside');

    move(110); // ratioY = 0.1
    expect(reorderable.zone()).toBe('before');

    dispose();
  });

  it('accepts=false → zone() null даже над целью', () => {
    const { dnd, reorderable, dispose } = mountReorderable({ accepts: () => false });
    dnd.startDrag('src', new PointerEvent('pointerdown', { clientX: 0, clientY: 0 }));
    move(150);
    expect(reorderable.zone()).toBeNull();
    dispose();
  });
});

// ---------------------------------------------------------------------------
// onDrop — zone по ratio
// ---------------------------------------------------------------------------

describe('createReorderable — onDrop', () => {
  it('зовётся с зоной по ratio (leaf → after)', () => {
    const onDrop = vi.fn();
    const { dnd, dispose } = mountReorderable({ canInside: () => false, onDrop });
    dnd.startDrag('src', new PointerEvent('pointerdown', { clientX: 0, clientY: 0 }));
    move(190);
    up(190); // ratioY = 0.9 → after
    expect(onDrop).toHaveBeenCalledTimes(1);
    expect(onDrop).toHaveBeenCalledWith({ id: 'src' }, 'after');
    dispose();
  });

  it('container: середина → inside', () => {
    const onDrop = vi.fn();
    const { dnd, dispose } = mountReorderable({ canInside: () => true, onDrop });
    dnd.startDrag('src', new PointerEvent('pointerdown', { clientX: 0, clientY: 0 }));
    move(150);
    up(150); // ratioY = 0.5 → inside
    expect(onDrop).toHaveBeenCalledWith({ id: 'src' }, 'inside');
    dispose();
  });

  it('accepts=false → onDrop НЕ зовётся (drop reject)', () => {
    const onDrop = vi.fn();
    const { dnd, dispose } = mountReorderable({ accepts: () => false, onDrop });
    dnd.startDrag('src', new PointerEvent('pointerdown', { clientX: 0, clientY: 0 }));
    move(150);
    up(150);
    expect(onDrop).not.toHaveBeenCalled();
    dispose();
  });
});

// ---------------------------------------------------------------------------
// disabled — цель не draggable
// ---------------------------------------------------------------------------

describe('createReorderable — disabled', () => {
  it('disabled=true → pointerdown на цели не стартует drag', () => {
    const { dnd, targetEl, dispose } = mountReorderable({ disabled: () => true });
    targetEl.dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, clientX: 50, clientY: 150, button: 0 }),
    );
    // Без движения даже; но проверим что после движения drag не начался.
    move(160);
    expect(dnd.state.activeId()).toBeNull();
    dispose();
  });
});

// ---------------------------------------------------------------------------
// no-op вне провайдера
// ---------------------------------------------------------------------------

describe('createReorderable — вне <DnDProvider>', () => {
  it('деградирует в no-op (не бросает)', () => {
    let api!: ReturnType<typeof createReorderable>;
    const dispose = render(() => {
      api = createReorderable({ id: 'x', data: {}, onDrop: () => {} });
      return <div />;
    }, container);
    expect(api.zone()).toBeNull();
    expect(api.isDragging()).toBe(false);
    // setRef — безопасный no-op.
    expect(() => api.setRef(document.createElement('div'))).not.toThrow();
    dispose();
  });
});

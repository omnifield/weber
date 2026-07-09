/**
 * Тесты для `@omnifield/web-dnd/controllers` (ADR 032, фаза 4).
 *
 * Контракт:
 *  1. `createEmittingDroppable` — emit вызывается с правильным payload на onDrop.
 *  2. `createEmittingDroppable` — emit onDragOver вызывается реактивно когда isOver + pointer.
 *  3. `createEmittingDraggable` — emit onDragStart/onDragEnd вызываются при переходах activeId.
 *  4. Без emit-функции — события не кидаются (no-op).
 *  5. Если emits-ключ не задан — emit НЕ вызывается.
 *
 * Стратегия mock'а:
 *  - EmitFn инжектируется через options.emit — простой vi.fn() spy.
 *    Нет зависимости на @omnifield/web-core вообще.
 *  - DnDProvider монтируется через render() (jsdom) — реальный pointer-state
 *    через programmatic dnd.startDrag() вызовы (тот же паттерн что в provider-cleanup.test.tsx).
 */
/* @vitest-environment jsdom */
import { render } from 'solid-js/web';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DnDProvider, useDnD } from '../context';
import { createEmittingDraggable } from '../controllers/emitting-draggable';
import { createEmittingDroppable } from '../controllers/emitting-droppable';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let container: HTMLDivElement;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
});

afterEach(() => {
  if (container.parentNode) document.body.removeChild(container);
  vi.restoreAllMocks();
});

/** Создаёт emit spy — передаётся в options.emit. */
function makeEmitSpy() {
  return vi.fn();
}

// ---------------------------------------------------------------------------
// createEmittingDroppable — onDrop emit
// ---------------------------------------------------------------------------

describe('createEmittingDroppable — onDrop emit', () => {
  it('вызывает emit(onDrop) с { data, pointer, dropInfo } при дропе', () => {
    const emitSpy = makeEmitSpy();

    // Stub document.elementFromPoint для droppable hit-testing
    const origEFP = document.elementFromPoint;
    let droppableEl!: HTMLElement;
    document.elementFromPoint = () => droppableEl ?? null;

    let capturedDnD: ReturnType<typeof useDnD> | null = null;

    const Harness = () => {
      capturedDnD = useDnD();

      // Регистрируем draggable вручную.
      const draggableEl = document.createElement('div');
      capturedDnD.registerDraggable({
        id: 'src-item',
        el: draggableEl,
        data: () => ({ kind: 'card', id: '42' }),
      });

      // createEmittingDroppable — emit инжектируется через options.
      const drop = createEmittingDroppable({
        id: 'zone-1',
        accepts: () => true,
        emits: { onDrop: 'onDrop' },
        emit: emitSpy,
      });

      return (
        <div
          ref={(el) => {
            droppableEl = el;
            drop.ref(el);
          }}
          data-testid="drop-zone"
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

    // Начинаем drag.
    const pe = new PointerEvent('pointerdown', { clientX: 10, clientY: 20 });
    capturedDnD!.startDrag('src-item', pe);

    // Симулируем pointerup над droppable.
    window.dispatchEvent(
      new PointerEvent('pointerup', { bubbles: true, clientX: 50, clientY: 60 }),
    );

    expect(emitSpy).toHaveBeenCalledOnce();
    const [eventName, target] = emitSpy.mock.calls[0];
    expect(eventName).toBe('onDrop');
    expect(target?.payload).toMatchObject({
      data: { kind: 'card', id: '42' },
      pointer: { x: 50, y: 60 },
    });
    expect(target?.payload?.dropInfo).toBeDefined();
    expect(target?.payload?.dropInfo?.draggableId).toBe('src-item');
    expect(target?.payload?.dropInfo?.droppableId).toBe('zone-1');

    dispose();
    document.elementFromPoint = origEFP;
  });

  it('НЕ вызывает emit если onDrop не задан в emits', () => {
    const emitSpy = makeEmitSpy();

    const origEFP = document.elementFromPoint;
    let droppableEl!: HTMLElement;
    document.elementFromPoint = () => droppableEl ?? null;

    let capturedDnD: ReturnType<typeof useDnD> | null = null;

    const Harness = () => {
      capturedDnD = useDnD();

      const draggableEl = document.createElement('div');
      capturedDnD.registerDraggable({
        id: 'src-noemit',
        el: draggableEl,
        data: () => ({ kind: 'card' }),
      });

      // emits пустой — onDrop не задан.
      const drop = createEmittingDroppable({
        id: 'zone-noemit',
        accepts: () => true,
        emits: {}, // нет onDrop
        emit: emitSpy,
      });

      return (
        <div
          ref={(el) => {
            droppableEl = el;
            drop.ref(el);
          }}
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

    const pe = new PointerEvent('pointerdown', { clientX: 5, clientY: 5 });
    capturedDnD!.startDrag('src-noemit', pe);

    window.dispatchEvent(
      new PointerEvent('pointerup', { bubbles: true, clientX: 50, clientY: 50 }),
    );

    // emit не должен вызываться.
    expect(emitSpy).not.toHaveBeenCalled();

    dispose();
    document.elementFromPoint = origEFP;
  });

  it('также вызывает оригинальный onDrop callback вместе с emit', () => {
    const emitSpy = makeEmitSpy();
    const originalOnDrop = vi.fn();

    const origEFP = document.elementFromPoint;
    let droppableEl!: HTMLElement;
    document.elementFromPoint = () => droppableEl ?? null;

    let capturedDnD: ReturnType<typeof useDnD> | null = null;

    const Harness = () => {
      capturedDnD = useDnD();

      const draggableEl = document.createElement('div');
      capturedDnD.registerDraggable({
        id: 'src-both',
        el: draggableEl,
        data: () => ({ kind: 'card' }),
      });

      const drop = createEmittingDroppable({
        id: 'zone-both',
        accepts: () => true,
        onDrop: originalOnDrop,
        emits: { onDrop: 'onDrop' },
        emit: emitSpy,
      });

      return (
        <div
          ref={(el) => {
            droppableEl = el;
            drop.ref(el);
          }}
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

    const pe = new PointerEvent('pointerdown', { clientX: 0, clientY: 0 });
    capturedDnD!.startDrag('src-both', pe);

    window.dispatchEvent(
      new PointerEvent('pointerup', { bubbles: true, clientX: 30, clientY: 30 }),
    );

    // Оба должны вызваться.
    expect(emitSpy).toHaveBeenCalledOnce();
    expect(originalOnDrop).toHaveBeenCalledOnce();

    dispose();
    document.elementFromPoint = origEFP;
  });

  it('НЕ вызывает emit если emit-функция не передана (no-op)', () => {
    const origEFP = document.elementFromPoint;
    let droppableEl!: HTMLElement;
    document.elementFromPoint = () => droppableEl ?? null;

    let capturedDnD: ReturnType<typeof useDnD> | null = null;

    const Harness = () => {
      capturedDnD = useDnD();

      const draggableEl = document.createElement('div');
      capturedDnD.registerDraggable({
        id: 'src-nofn',
        el: draggableEl,
        data: () => ({ kind: 'card' }),
      });

      // emit НЕ передан — auto-emit должен быть no-op.
      const drop = createEmittingDroppable({
        id: 'zone-nofn',
        accepts: () => true,
        emits: { onDrop: 'onDrop' },
        // emit: undefined — намеренно
      });

      return (
        <div
          ref={(el) => {
            droppableEl = el;
            drop.ref(el);
          }}
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

    const pe = new PointerEvent('pointerdown', { clientX: 5, clientY: 5 });
    capturedDnD!.startDrag('src-nofn', pe);
    // Не должен бросить и не должен вызвать emit (которого нет).
    expect(() => {
      window.dispatchEvent(
        new PointerEvent('pointerup', { bubbles: true, clientX: 50, clientY: 50 }),
      );
    }).not.toThrow();

    dispose();
    document.elementFromPoint = origEFP;
  });
});

// ---------------------------------------------------------------------------
// createEmittingDroppable — onDragOver emit
// ---------------------------------------------------------------------------

describe('createEmittingDroppable — onDragOver emit', () => {
  it('вызывает emit(onDragOver) с { data, pointer } когда isOver + pointer реактивно', async () => {
    const emitSpy = makeEmitSpy();

    const origEFP = document.elementFromPoint;
    let droppableEl!: HTMLElement;
    document.elementFromPoint = () => droppableEl ?? null;

    let capturedDnD: ReturnType<typeof useDnD> | null = null;

    const Harness = () => {
      capturedDnD = useDnD();

      const draggableEl = document.createElement('div');
      capturedDnD.registerDraggable({
        id: 'src-over',
        el: draggableEl,
        data: () => ({ kind: 'widget' }),
      });

      const drop = createEmittingDroppable({
        id: 'zone-over',
        accepts: () => true,
        emits: { onDragOver: 'onDragOver' },
        emit: emitSpy,
      });

      return (
        <div
          ref={(el) => {
            droppableEl = el;
            drop.ref(el);
          }}
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

    // Начинаем drag — это установит activeId и activeData.
    const pe = new PointerEvent('pointerdown', { clientX: 5, clientY: 5 });
    capturedDnD!.startDrag('src-over', pe);

    // Двигаем pointer над droppable-зоной.
    // document.elementFromPoint возвращает droppableEl → overId = 'zone-over' → isOver = true.
    window.dispatchEvent(
      new PointerEvent('pointermove', { bubbles: true, clientX: 100, clientY: 100 }),
    );

    // Reactive effects в Solid синхронны при наличии сигналов, поэтому
    // emit должен был сработать в том же sync-tick.
    expect(emitSpy).toHaveBeenCalled();
    const call = emitSpy.mock.calls.find((c) => c[0] === 'onDragOver');
    expect(call).toBeDefined();
    expect(call![1]?.payload?.data).toMatchObject({ kind: 'widget' });
    expect(call![1]?.payload?.pointer).toBeDefined();

    window.dispatchEvent(
      new PointerEvent('pointerup', { bubbles: true, clientX: 100, clientY: 100 }),
    );
    dispose();
    document.elementFromPoint = origEFP;
  });
});

// ---------------------------------------------------------------------------
// createEmittingDraggable — onDragStart / onDragEnd
// ---------------------------------------------------------------------------

describe('createEmittingDraggable — onDragStart / onDragEnd', () => {
  it('вызывает emit(onDragStart) с { data, pointer } когда drag начат', async () => {
    const emitSpy = makeEmitSpy();

    const origEFP = document.elementFromPoint;
    document.elementFromPoint = () => null;

    let capturedDnD: ReturnType<typeof useDnD> | null = null;

    const Harness = () => {
      capturedDnD = useDnD();

      // createEmittingDraggable регистрирует draggable и отслеживает isDragging.
      const drag = createEmittingDraggable({
        id: 'emitting-drag',
        data: () => ({ kind: 'node', nodeId: '99' }),
        emits: { onDragStart: 'onDragStart' },
        emit: emitSpy,
      });

      return <div ref={drag.ref} />;
    };

    const dispose = render(
      () => (
        <DnDProvider>
          <Harness />
        </DnDProvider>
      ),
      container,
    );

    // Запускаем drag programmatically.
    const pe = new PointerEvent('pointerdown', { clientX: 15, clientY: 25 });
    capturedDnD!.startDrag('emitting-drag', pe);

    // Дать Solid reactive effects запуститься (они синхронны при Solid update,
    // но могут требовать microtask flush).
    await Promise.resolve();
    await Promise.resolve();

    // onDragStart должен быть эмитирован.
    expect(emitSpy).toHaveBeenCalled();
    const startCall = emitSpy.mock.calls.find((c) => c[0] === 'onDragStart');
    expect(startCall).toBeDefined();
    expect(startCall![1]?.payload?.data).toMatchObject({ kind: 'node', nodeId: '99' });
    expect(startCall![1]?.payload?.pointer).toMatchObject({ x: 15, y: 25 });

    window.dispatchEvent(
      new PointerEvent('pointerup', { bubbles: true, clientX: 15, clientY: 25 }),
    );
    dispose();
    document.elementFromPoint = origEFP;
  });

  it('вызывает emit(onDragEnd) когда drag завершён (pointerup)', async () => {
    const emitSpy = makeEmitSpy();

    const origEFP = document.elementFromPoint;
    document.elementFromPoint = () => null;

    let capturedDnD: ReturnType<typeof useDnD> | null = null;

    const Harness = () => {
      capturedDnD = useDnD();

      const drag = createEmittingDraggable({
        id: 'emitting-drag-end',
        data: () => ({ kind: 'node', nodeId: '77' }),
        emits: { onDragEnd: 'onDragEnd' },
        emit: emitSpy,
      });

      return <div ref={drag.ref} />;
    };

    const dispose = render(
      () => (
        <DnDProvider>
          <Harness />
        </DnDProvider>
      ),
      container,
    );

    const pe = new PointerEvent('pointerdown', { clientX: 0, clientY: 0 });
    capturedDnD!.startDrag('emitting-drag-end', pe);

    // Ждём microtask — Solid effects после startDrag.
    await Promise.resolve();

    // Завершаем drag.
    window.dispatchEvent(
      new PointerEvent('pointerup', { bubbles: true, clientX: 20, clientY: 30 }),
    );

    // Ждём microtask — Solid effects после pointerup (activeId → null).
    await Promise.resolve();

    const endCall = emitSpy.mock.calls.find((c) => c[0] === 'onDragEnd');
    expect(endCall).toBeDefined();
    expect(endCall![1]?.payload?.data).toMatchObject({ kind: 'node', nodeId: '77' });

    dispose();
    document.elementFromPoint = origEFP;
  });

  it('НЕ вызывает emit(onDragStart) для другого draggable-id', async () => {
    const emitSpy = makeEmitSpy();

    const origEFP = document.elementFromPoint;
    document.elementFromPoint = () => null;

    let capturedDnD: ReturnType<typeof useDnD> | null = null;

    const Harness = () => {
      capturedDnD = useDnD();

      // Регистрируем ДРУГОЙ draggable напрямую.
      const otherEl = document.createElement('div');
      capturedDnD.registerDraggable({
        id: 'other-drag',
        el: otherEl,
        data: () => ({ kind: 'other' }),
      });

      // createEmittingDraggable следит за 'my-drag'.
      const drag = createEmittingDraggable({
        id: 'my-drag',
        data: () => ({ kind: 'node' }),
        emits: { onDragStart: 'onDragStart' },
        emit: emitSpy,
      });

      return <div ref={drag.ref} />;
    };

    const dispose = render(
      () => (
        <DnDProvider>
          <Harness />
        </DnDProvider>
      ),
      container,
    );

    // Запускаем drag OTHER-го draggable, не 'my-drag'.
    const pe = new PointerEvent('pointerdown', { clientX: 0, clientY: 0 });
    capturedDnD!.startDrag('other-drag', pe);

    // Ждём microtask.
    await Promise.resolve();

    // emit(onDragStart) не должен вызываться для 'my-drag'.
    const startCall = emitSpy.mock.calls.find((c) => c[0] === 'onDragStart');
    expect(startCall).toBeUndefined();

    window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: 0, clientY: 0 }));
    dispose();
    document.elementFromPoint = origEFP;
  });
});

// ---------------------------------------------------------------------------
// emit-функция не передана — вне Controller-scope (no-op, не бросает)
// ---------------------------------------------------------------------------

describe('emit не передан — no-op, не бросает', () => {
  it('createEmittingDraggable работает без emit (no-op)', async () => {
    const origEFP = document.elementFromPoint;
    document.elementFromPoint = () => null;

    let capturedDnD: ReturnType<typeof useDnD> | null = null;

    const Harness = () => {
      capturedDnD = useDnD();

      const drag = createEmittingDraggable({
        id: 'nofn-drag',
        data: () => ({ kind: 'node' }),
        emits: { onDragStart: 'onDragStart', onDragEnd: 'onDragEnd' },
        // emit: undefined — намеренно
      });

      return <div ref={drag.ref} />;
    };

    const dispose = render(
      () => (
        <DnDProvider>
          <Harness />
        </DnDProvider>
      ),
      container,
    );

    expect(() => {
      capturedDnD!.startDrag(
        'nofn-drag',
        new PointerEvent('pointerdown', { clientX: 0, clientY: 0 }),
      );
      window.dispatchEvent(
        new PointerEvent('pointerup', { bubbles: true, clientX: 0, clientY: 0 }),
      );
    }).not.toThrow();

    dispose();
    document.elementFromPoint = origEFP;
  });
});

// ---------------------------------------------------------------------------
// payload shape — IDragPayload / IDropPayload type checks (runtime)
// ---------------------------------------------------------------------------

describe('payload shape — runtime assertions', () => {
  it('onDrop payload содержит data, pointer, dropInfo', () => {
    const emitSpy = makeEmitSpy();

    const origEFP = document.elementFromPoint;
    let droppableEl!: HTMLElement;
    document.elementFromPoint = () => droppableEl ?? null;

    let capturedDnD: ReturnType<typeof useDnD> | null = null;

    const Harness = () => {
      capturedDnD = useDnD();

      const draggableEl = document.createElement('div');
      capturedDnD.registerDraggable({
        id: 'shape-src',
        el: draggableEl,
        data: () => ({ kind: 'shape', color: 'red' }),
      });

      const drop = createEmittingDroppable({
        id: 'shape-zone',
        accepts: () => true,
        emits: { onDrop: 'onDrop' },
        emit: emitSpy,
      });

      return (
        <div
          ref={(el) => {
            droppableEl = el;
            drop.ref(el);
          }}
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

    capturedDnD!.startDrag(
      'shape-src',
      new PointerEvent('pointerdown', { clientX: 1, clientY: 2 }),
    );
    window.dispatchEvent(
      new PointerEvent('pointerup', { bubbles: true, clientX: 77, clientY: 88 }),
    );

    expect(emitSpy).toHaveBeenCalledOnce();
    const payload = emitSpy.mock.calls[0][1]?.payload;

    // IDragPayload
    expect(payload).toHaveProperty('data');
    expect(payload).toHaveProperty('pointer');
    expect(payload.data).toMatchObject({ kind: 'shape', color: 'red' });
    expect(payload.pointer).toMatchObject({ x: 77, y: 88 });

    // IDropPayload extra
    expect(payload).toHaveProperty('dropInfo');
    expect(payload.dropInfo).toHaveProperty('draggableId', 'shape-src');
    expect(payload.dropInfo).toHaveProperty('droppableId', 'shape-zone');
    expect(payload.dropInfo).toHaveProperty('pointer');
    expect(payload.dropInfo).toHaveProperty('ratio');

    dispose();
    document.elementFromPoint = origEFP;
  });
});

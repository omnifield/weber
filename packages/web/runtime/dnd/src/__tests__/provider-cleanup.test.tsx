/**
 * Tests for DnDProvider defensive cleanup on unmount.
 *
 * Edge case: user begins drag → route change unmounts DnDProvider before
 * drag ends. Without onCleanup(cleanup), 4 window-level listeners
 * (pointermove, pointerup, pointercancel, keydown) remain attached with
 * stale signal closures. Each interrupted drag = +4 orphan listeners.
 *
 * onCleanup(cleanup) in context.tsx closes this. These tests verify it.
 */
/* @vitest-environment jsdom */
import { render } from 'solid-js/web';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DnDProvider, useDnD } from '../context';
import { createDraggable } from '../draggable';
import { createDroppable } from '../droppable';

let container: HTMLDivElement;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
});

afterEach(() => {
  if (container.parentNode) document.body.removeChild(container);
});

// ---------------------------------------------------------------------------
// Helper: fire a synthetic PointerEvent on window
// ---------------------------------------------------------------------------
function fireWindowPointerEvent(type: string, init?: PointerEventInit) {
  const evt = new PointerEvent(type, { bubbles: true, cancelable: true, ...init });
  window.dispatchEvent(evt);
  return evt;
}

// ---------------------------------------------------------------------------
// Test 1: no listeners are attached when no drag has started
// ---------------------------------------------------------------------------
describe('DnDProvider — window listeners lifecycle', () => {
  it('no window listeners attached before drag starts', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');

    const dispose = render(() => <DnDProvider>{null}</DnDProvider>, container);
    dispose();

    // addEventListener should not have been called for drag-tracking events
    const dragEvents = ['pointermove', 'pointerup', 'pointercancel', 'keydown'];
    for (const evt of dragEvents) {
      const calls = addSpy.mock.calls.filter((c) => c[0] === evt);
      expect(calls.length, `${evt} should not be added before drag`).toBe(0);
    }

    addSpy.mockRestore();
  });

  // -------------------------------------------------------------------------
  // Test 2: startDrag attaches exactly 4 listeners
  // -------------------------------------------------------------------------
  it('startDrag attaches 4 window listeners', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    let capturedDnD: ReturnType<typeof useDnD> | null = null;

    // We need a real draggable element registered so startDrag does not bail
    // out early at `if (!entry) return`. Build a minimal IDraggableEntry by
    // reaching into the context via a child component.
    const Harness = () => {
      const dnd = useDnD();
      capturedDnD = dnd;

      // Register a minimal draggable entry
      const el = document.createElement('div');
      dnd.registerDraggable({
        id: 'test-drag',
        el,
        data: () => ({ kind: 'test' }),
      });

      return <div />;
    };

    const dispose = render(
      () => (
        <DnDProvider>
          <Harness />
        </DnDProvider>
      ),
      container,
    );

    // Clear spy calls accumulated during render
    addSpy.mockClear();

    // Fire startDrag
    const pe = new PointerEvent('pointerdown', { clientX: 10, clientY: 20 });
    capturedDnD!.startDrag('test-drag', pe);

    const dragEvents = ['pointermove', 'pointerup', 'pointercancel', 'keydown'];
    for (const evt of dragEvents) {
      const calls = addSpy.mock.calls.filter((c) => c[0] === evt);
      expect(calls.length, `${evt} should be added once`).toBe(1);
    }

    dispose();
    addSpy.mockRestore();
  });

  // -------------------------------------------------------------------------
  // Test 3: CORE — unmount during active drag removes all 4 listeners
  // -------------------------------------------------------------------------
  it('unmount during active drag removes all 4 window listeners', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    let capturedDnD: ReturnType<typeof useDnD> | null = null;

    const Harness = () => {
      const dnd = useDnD();
      capturedDnD = dnd;

      const el = document.createElement('div');
      dnd.registerDraggable({
        id: 'drag-unmount',
        el,
        data: () => ({ kind: 'unmount-test' }),
      });

      return <div />;
    };

    const dispose = render(
      () => (
        <DnDProvider>
          <Harness />
        </DnDProvider>
      ),
      container,
    );

    // Start drag so listeners are attached
    const pe = new PointerEvent('pointerdown', { clientX: 5, clientY: 5 });
    capturedDnD!.startDrag('drag-unmount', pe);

    // Clear spy calls from startDrag phase
    removeSpy.mockClear();

    // Unmount provider (simulates route change mid-drag)
    dispose();

    const dragEvents = ['pointermove', 'pointerup', 'pointercancel', 'keydown'];
    for (const evt of dragEvents) {
      const calls = removeSpy.mock.calls.filter((c) => c[0] === evt);
      expect(calls.length, `${evt} should be removed on unmount`).toBeGreaterThanOrEqual(1);
    }

    removeSpy.mockRestore();
  });

  // -------------------------------------------------------------------------
  // Test 4: normal drag completion (pointerup) also removes all 4 listeners
  // -------------------------------------------------------------------------
  it('normal pointerup removes all 4 window listeners', () => {
    // jsdom does not implement document.elementFromPoint — stub it so onPointerUp
    // can complete without throwing before it calls cleanup().
    const elemFromPointOrig = document.elementFromPoint;
    document.elementFromPoint = () => null;

    const removeSpy = vi.spyOn(window, 'removeEventListener');
    let capturedDnD: ReturnType<typeof useDnD> | null = null;

    const Harness = () => {
      const dnd = useDnD();
      capturedDnD = dnd;

      const el = document.createElement('div');
      dnd.registerDraggable({
        id: 'drag-normal',
        el,
        data: () => ({ kind: 'normal' }),
      });

      return <div />;
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
    capturedDnD!.startDrag('drag-normal', pe);

    removeSpy.mockClear();

    // Fire pointerup — normal completion path
    fireWindowPointerEvent('pointerup', { clientX: 0, clientY: 0 });

    const dragEvents = ['pointermove', 'pointerup', 'pointercancel', 'keydown'];
    for (const evt of dragEvents) {
      const calls = removeSpy.mock.calls.filter((c) => c[0] === evt);
      expect(calls.length, `${evt} should be removed after pointerup`).toBeGreaterThanOrEqual(1);
    }

    dispose();
    removeSpy.mockRestore();
    document.elementFromPoint = elemFromPointOrig;
  });

  // -------------------------------------------------------------------------
  // Test 5: Escape key also cleans up listeners
  // -------------------------------------------------------------------------
  it('Escape keydown removes all 4 window listeners (direct startDrag)', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    let capturedDnD: ReturnType<typeof useDnD> | null = null;

    const Harness = () => {
      const dnd = useDnD();
      capturedDnD = dnd;

      const el = document.createElement('div');
      dnd.registerDraggable({
        id: 'drag-escape',
        el,
        data: () => ({ kind: 'escape-test' }),
      });

      return <div />;
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
    capturedDnD!.startDrag('drag-escape', pe);

    removeSpy.mockClear();

    // Fire Escape
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    const dragEvents = ['pointermove', 'pointerup', 'pointercancel', 'keydown'];
    for (const evt of dragEvents) {
      const calls = removeSpy.mock.calls.filter((c) => c[0] === evt);
      expect(calls.length, `${evt} should be removed after Escape`).toBeGreaterThanOrEqual(1);
    }

    dispose();
    removeSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// Activation threshold — plain click must NOT trigger drag or onDrop
// ---------------------------------------------------------------------------

describe('activation threshold (createDraggable)', () => {
  // jsdom does not implement document.elementFromPoint — stub it so that
  // droppable hit-testing inside DnDProvider.onPointerUp doesn't crash if
  // somehow startDrag fires unexpectedly.
  let origEFP: typeof document.elementFromPoint;
  beforeEach(() => {
    origEFP = document.elementFromPoint;
    document.elementFromPoint = () => null;
  });
  afterEach(() => {
    document.elementFromPoint = origEFP;
  });

  // -------------------------------------------------------------------------
  // Test: pointerdown + pointerup without movement → onDrop NOT called
  // -------------------------------------------------------------------------
  it('plain click (no movement) does not call onDrop', () => {
    const onDrop = vi.fn();

    let draggableEl!: HTMLElement;
    let droppableEl!: HTMLElement;

    const Harness = () => {
      const drag = createDraggable({ id: 'click-drag', data: { kind: 'test' } });
      const drop = createDroppable({
        id: 'click-drop',
        accepts: () => true,
        onDrop,
      });

      return (
        <div>
          <div
            ref={(el) => {
              draggableEl = el;
              drag.ref(el);
            }}
            id="drag-el"
          >
            drag
          </div>
          <div
            ref={(el) => {
              droppableEl = el;
              drop.ref(el);
            }}
            id="drop-el"
          >
            drop
          </div>
        </div>
      );
    };

    const dispose = render(
      () => (
        // activationDistance=10 — far higher than zero movement in this test
        <DnDProvider activationDistance={10}>
          <Harness />
        </DnDProvider>
      ),
      container,
    );

    // Simulate plain click: pointerdown then immediate pointerup at same coords
    const down = new PointerEvent('pointerdown', {
      bubbles: true,
      cancelable: true,
      clientX: 50,
      clientY: 50,
      button: 0,
    });
    draggableEl.dispatchEvent(down);

    // pointerup fires on window without any intervening pointermove
    window.dispatchEvent(
      new PointerEvent('pointerup', {
        bubbles: true,
        cancelable: true,
        clientX: 50,
        clientY: 50,
      }),
    );

    expect(onDrop).not.toHaveBeenCalled();

    dispose();
  });

  // -------------------------------------------------------------------------
  // Test: movement past threshold triggers startDrag → window listeners added
  // -------------------------------------------------------------------------
  it('movement >= activationDistance triggers startDrag (window listeners attached)', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');

    let draggableEl!: HTMLElement;

    const Harness = () => {
      const drag = createDraggable({ id: 'threshold-drag', data: { kind: 'test' } });
      return (
        <div
          ref={(el) => {
            draggableEl = el;
            drag.ref(el);
          }}
          id="drag-threshold"
        >
          drag
        </div>
      );
    };

    const dispose = render(
      () => (
        <DnDProvider activationDistance={5}>
          <Harness />
        </DnDProvider>
      ),
      container,
    );

    // pointerdown at (0, 0)
    draggableEl.dispatchEvent(
      new PointerEvent('pointerdown', {
        bubbles: true,
        cancelable: true,
        clientX: 0,
        clientY: 0,
        button: 0,
      }),
    );

    // Clear spy — we only want to count window.addEventListener calls that happen
    // AFTER the threshold is crossed (those come from DnDProvider.startDrag).
    addSpy.mockClear();

    // Move 10px — past the 5px threshold
    window.dispatchEvent(
      new PointerEvent('pointermove', {
        bubbles: true,
        cancelable: true,
        clientX: 10,
        clientY: 0,
      }),
    );

    // DnDProvider.startDrag should have attached exactly 4 window listeners
    const dragEvents = ['pointermove', 'pointerup', 'pointercancel', 'keydown'];
    for (const evt of dragEvents) {
      const calls = addSpy.mock.calls.filter((c) => c[0] === evt);
      expect(calls.length, `${evt} should be added once after threshold`).toBe(1);
    }

    // Cleanup
    window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: 10, clientY: 0 }));
    dispose();
    addSpy.mockRestore();
  });

  // -------------------------------------------------------------------------
  // Test: movement below threshold does NOT trigger startDrag
  // -------------------------------------------------------------------------
  it('movement < activationDistance does NOT trigger startDrag', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');

    let draggableEl!: HTMLElement;

    const Harness = () => {
      const drag = createDraggable({ id: 'below-threshold', data: { kind: 'test' } });
      return (
        <div
          ref={(el) => {
            draggableEl = el;
            drag.ref(el);
          }}
          id="drag-below"
        >
          drag
        </div>
      );
    };

    const dispose = render(
      () => (
        // activationDistance=20 — we'll only move 5px
        <DnDProvider activationDistance={20}>
          <Harness />
        </DnDProvider>
      ),
      container,
    );

    draggableEl.dispatchEvent(
      new PointerEvent('pointerdown', {
        bubbles: true,
        cancelable: true,
        clientX: 0,
        clientY: 0,
        button: 0,
      }),
    );

    addSpy.mockClear();

    // Move only 5px — below 20px threshold
    window.dispatchEvent(
      new PointerEvent('pointermove', {
        bubbles: true,
        cancelable: true,
        clientX: 5,
        clientY: 0,
      }),
    );

    const dragEvents = ['pointermove', 'pointerup', 'pointercancel', 'keydown'];
    for (const evt of dragEvents) {
      const calls = addSpy.mock.calls.filter((c) => c[0] === evt);
      expect(calls.length, `${evt} should NOT be added (threshold not crossed)`).toBe(0);
    }

    // Release without crossing threshold
    window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: 5, clientY: 0 }));
    dispose();
    addSpy.mockRestore();
  });

  // -------------------------------------------------------------------------
  // Test: per-draggable activationDistance overrides provider value
  // -------------------------------------------------------------------------
  it('per-draggable activationDistance overrides provider default', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');

    let draggableEl!: HTMLElement;

    const Harness = () => {
      // Provider says 50px, but this draggable overrides to 2px
      const drag = createDraggable({
        id: 'per-drag-threshold',
        data: { kind: 'test' },
        activationDistance: 2,
      });
      return (
        <div
          ref={(el) => {
            draggableEl = el;
            drag.ref(el);
          }}
          id="drag-per"
        >
          drag
        </div>
      );
    };

    const dispose = render(
      () => (
        <DnDProvider activationDistance={50}>
          <Harness />
        </DnDProvider>
      ),
      container,
    );

    draggableEl.dispatchEvent(
      new PointerEvent('pointerdown', {
        bubbles: true,
        cancelable: true,
        clientX: 0,
        clientY: 0,
        button: 0,
      }),
    );

    addSpy.mockClear();

    // Move only 3px — below provider's 50px but above draggable's 2px
    window.dispatchEvent(
      new PointerEvent('pointermove', {
        bubbles: true,
        cancelable: true,
        clientX: 3,
        clientY: 0,
      }),
    );

    // Draggable override of 2px should be respected → startDrag fired
    const dragEvents = ['pointermove', 'pointerup', 'pointercancel', 'keydown'];
    for (const evt of dragEvents) {
      const calls = addSpy.mock.calls.filter((c) => c[0] === evt);
      expect(calls.length, `${evt} should be added once (draggable override)`).toBe(1);
    }

    window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: 3, clientY: 0 }));
    dispose();
    addSpy.mockRestore();
  });
});

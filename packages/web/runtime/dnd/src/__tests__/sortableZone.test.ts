/**
 * Unit tests for the pure geometric helpers in sortableZone.ts.
 *
 * jsdom does not measure layout (getBoundingClientRect returns zeros), so the
 * entire reactive createSortableGroup integration is verified in the browser
 * (Phase 3, ADR 025). These tests cover the only unit-testable surface: the
 * pure index-computation and zone-lookup functions.
 */
import { describe, expect, it } from 'vitest';
import type { IRect } from '../sortableZone';
import { computeInsertIndex, findNearestZone, findZoneAtPoint } from '../sortableZone';

// ---------------------------------------------------------------------------
// Helpers to build mock rects
// ---------------------------------------------------------------------------

function rect(left: number, top: number, width: number, height: number): IRect {
  return { left, top, right: left + width, bottom: top + height, width, height };
}

// ---------------------------------------------------------------------------
// computeInsertIndex — axis: 'y' (vertical list)
// ---------------------------------------------------------------------------

describe('computeInsertIndex — axis y', () => {
  // 3 items stacked vertically: y=[0,20], y=[30,50], y=[60,80]
  const rects: IRect[] = [rect(0, 0, 100, 20), rect(0, 30, 100, 20), rect(0, 60, 100, 20)];
  // centers: y=10, y=40, y=70

  it('empty array always returns 0', () => {
    expect(computeInsertIndex({ x: 50, y: 50 }, 'y', [])).toBe(0);
  });

  it('pointer before first item center → index 0', () => {
    // center of first item = y 10; pointer at y 5 (< 10)
    expect(computeInsertIndex({ x: 50, y: 5 }, 'y', rects)).toBe(0);
  });

  it('pointer between first and second centers → index 1', () => {
    // 10 < 25 < 40
    expect(computeInsertIndex({ x: 50, y: 25 }, 'y', rects)).toBe(1);
  });

  it('pointer between second and third centers → index 2', () => {
    // 40 < 55 < 70
    expect(computeInsertIndex({ x: 50, y: 55 }, 'y', rects)).toBe(2);
  });

  it('pointer after last item center → index 3 (append)', () => {
    // 70 < 75
    expect(computeInsertIndex({ x: 50, y: 75 }, 'y', rects)).toBe(3);
  });

  it('single item — pointer before center → 0', () => {
    expect(computeInsertIndex({ x: 50, y: 5 }, 'y', [rect(0, 0, 100, 20)])).toBe(0);
  });

  it('single item — pointer after center → 1', () => {
    expect(computeInsertIndex({ x: 50, y: 15 }, 'y', [rect(0, 0, 100, 20)])).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// computeInsertIndex — axis: 'x' (horizontal row)
// ---------------------------------------------------------------------------

describe('computeInsertIndex — axis x', () => {
  // 3 items in a row: x=[0,40], x=[50,90], x=[100,140]
  const rects: IRect[] = [rect(0, 0, 40, 30), rect(50, 0, 40, 30), rect(100, 0, 40, 30)];
  // centers: x=20, x=70, x=120

  it('pointer before first center → 0', () => {
    expect(computeInsertIndex({ x: 10, y: 15 }, 'x', rects)).toBe(0);
  });

  it('pointer between first and second → 1', () => {
    expect(computeInsertIndex({ x: 45, y: 15 }, 'x', rects)).toBe(1);
  });

  it('pointer between second and third → 2', () => {
    expect(computeInsertIndex({ x: 95, y: 15 }, 'x', rects)).toBe(2);
  });

  it('pointer after last → 3', () => {
    expect(computeInsertIndex({ x: 130, y: 15 }, 'x', rects)).toBe(3);
  });

  it('empty array → 0', () => {
    expect(computeInsertIndex({ x: 100, y: 0 }, 'x', [])).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// computeInsertIndex — axis: 'grid' (2D wrap)
// ---------------------------------------------------------------------------

describe('computeInsertIndex — axis grid', () => {
  /**
   * 2×2 grid layout:
   *   [0]  x=[0,40]   y=[0,40]   center=(20,20)
   *   [1]  x=[50,90]  y=[0,40]   center=(70,20)
   *   [2]  x=[0,40]   y=[50,90]  center=(20,70)
   *   [3]  x=[50,90]  y=[50,90]  center=(70,70)
   */
  const rects: IRect[] = [
    rect(0, 0, 40, 40),
    rect(50, 0, 40, 40),
    rect(0, 50, 40, 40),
    rect(50, 50, 40, 40),
  ];

  it('pointer nearest to item 0, left of center → insert before 0', () => {
    // nearest = item 0 (center 20,20); point (10,20): x(10)<cx(20) → index 0
    expect(computeInsertIndex({ x: 10, y: 20 }, 'grid', rects)).toBe(0);
  });

  it('pointer nearest to item 0, right of center → insert after 0 (index 1)', () => {
    // nearest = item 0 (center 20,20); point (30,20): x(30)>cx(20) → index 1
    expect(computeInsertIndex({ x: 30, y: 20 }, 'grid', rects)).toBe(1);
  });

  it('pointer nearest to item 1 → insert after 1 (index 2)', () => {
    // nearest = item 1 (center 70,20); point (80,20): x(80)>cx(70) → index 2
    expect(computeInsertIndex({ x: 80, y: 20 }, 'grid', rects)).toBe(2);
  });

  it('pointer nearest to item 2 → insert before 2 (index 2)', () => {
    // nearest = item 2 (center 20,70); point (10,70): x(10)<cx(20) → index 2
    expect(computeInsertIndex({ x: 10, y: 70 }, 'grid', rects)).toBe(2);
  });

  it('pointer nearest to item 3 → insert after 3 (append, index 4)', () => {
    // nearest = item 3 (center 70,70); point (80,70): x(80)>cx(70) → index 4
    expect(computeInsertIndex({ x: 80, y: 70 }, 'grid', rects)).toBe(4);
  });

  it('empty array → 0', () => {
    expect(computeInsertIndex({ x: 50, y: 50 }, 'grid', [])).toBe(0);
  });

  it('single item — pointer left of center → 0', () => {
    expect(computeInsertIndex({ x: 10, y: 20 }, 'grid', [rect(0, 0, 40, 40)])).toBe(0);
  });

  it('single item — pointer right of center → 1', () => {
    expect(computeInsertIndex({ x: 30, y: 20 }, 'grid', [rect(0, 0, 40, 40)])).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// findZoneAtPoint
// ---------------------------------------------------------------------------

describe('findZoneAtPoint', () => {
  const zones = [
    { id: 'zone-a', rect: rect(0, 0, 100, 100) },
    { id: 'zone-b', rect: rect(110, 0, 100, 100) },
  ];

  it('returns zone id when pointer is inside', () => {
    expect(findZoneAtPoint({ x: 50, y: 50 }, zones)).toBe('zone-a');
    expect(findZoneAtPoint({ x: 150, y: 50 }, zones)).toBe('zone-b');
  });

  it('returns null when pointer is between zones', () => {
    // x=105 is between zone-a (0–100) and zone-b (110–210)
    expect(findZoneAtPoint({ x: 105, y: 50 }, zones)).toBeNull();
  });

  it('returns null for empty zone list', () => {
    expect(findZoneAtPoint({ x: 50, y: 50 }, [])).toBeNull();
  });

  it('pointer on boundary (right/bottom edge inclusive)', () => {
    // right edge of zone-a is x=100
    expect(findZoneAtPoint({ x: 100, y: 50 }, zones)).toBe('zone-a');
  });
});

// ---------------------------------------------------------------------------
// findNearestZone
// ---------------------------------------------------------------------------

describe('findNearestZone', () => {
  const zones = [
    { id: 'left', rect: rect(0, 0, 100, 100) }, // center (50, 50)
    { id: 'right', rect: rect(200, 0, 100, 100) }, // center (250, 50)
  ];

  it('returns nearest zone by center distance', () => {
    // pointer at (80, 50): closer to left (dist²=900) than right (dist²=28900)
    expect(findNearestZone({ x: 80, y: 50 }, zones)).toBe('left');
    // pointer at (220, 50): closer to right
    expect(findNearestZone({ x: 220, y: 50 }, zones)).toBe('right');
  });

  it('returns null for empty list', () => {
    expect(findNearestZone({ x: 50, y: 50 }, [])).toBeNull();
  });

  it('returns the only zone when list has one entry', () => {
    expect(findNearestZone({ x: 999, y: 999 }, [{ id: 'only', rect: rect(0, 0, 10, 10) }])).toBe(
      'only',
    );
  });
});

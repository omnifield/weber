/**
 * Unit tests for the pure grid-math helpers in grid.ts.
 *
 * ADR 026 Phase 1. All functions are pure (no DOM, no Solid reactivity) so
 * jsdom is not exercised for geometry — hand-built IGridLayout fixtures + explicit
 * containerRect values cover the full invariant set.
 */
import { describe, expect, it } from 'vitest';
import type { IGridItem, IGridLayout } from '../grid';
import {
  clampToCols,
  collides,
  compactVertical,
  getCollisions,
  moveItem,
  placeItem,
  pointToCell,
  resizeItem,
} from '../grid';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function item(id: string, x: number, y: number, w: number, h: number): IGridItem {
  return { id, x, y, w, h };
}

// ---------------------------------------------------------------------------
// collides
// ---------------------------------------------------------------------------

describe('collides', () => {
  it('overlapping items → true', () => {
    // A: x[0,2) y[0,2)  B: x[1,3) y[1,3) — share cell (1,1)
    expect(collides(item('a', 0, 0, 2, 2), item('b', 1, 1, 2, 2))).toBe(true);
  });

  it('fully contained → true', () => {
    // B sits entirely inside A
    expect(collides(item('a', 0, 0, 4, 4), item('b', 1, 1, 2, 2))).toBe(true);
  });

  it('edge-adjacent on x axis → false (touching, not overlapping)', () => {
    // A ends at x=2; B starts at x=2 — touching, no shared cell
    expect(collides(item('a', 0, 0, 2, 2), item('b', 2, 0, 2, 2))).toBe(false);
  });

  it('edge-adjacent on y axis → false', () => {
    // A ends at y=2; B starts at y=2
    expect(collides(item('a', 0, 0, 2, 2), item('b', 0, 2, 2, 2))).toBe(false);
  });

  it('completely separate → false', () => {
    expect(collides(item('a', 0, 0, 2, 2), item('b', 5, 5, 2, 2))).toBe(false);
  });

  it('same id → false (item does not collide with itself)', () => {
    const a = item('a', 0, 0, 2, 2);
    expect(collides(a, { ...a })).toBe(false);
  });

  it('1×1 items at same position → true', () => {
    expect(collides(item('a', 3, 3, 1, 1), item('b', 3, 3, 1, 1))).toBe(true);
  });

  it('1×1 items diagonally adjacent → false', () => {
    // (0,0) and (1,1): x ranges [0,1) and [1,2) — x-ranges don't overlap
    expect(collides(item('a', 0, 0, 1, 1), item('b', 1, 1, 1, 1))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getCollisions
// ---------------------------------------------------------------------------

describe('getCollisions', () => {
  const layout: IGridLayout = [
    item('a', 0, 0, 2, 2),
    item('b', 1, 1, 2, 2), // overlaps a
    item('c', 5, 5, 2, 2), // no overlap
  ];

  it('returns items that overlap the given item', () => {
    const cols = getCollisions(layout, item('a', 0, 0, 2, 2));
    expect(cols.map((i) => i.id)).toEqual(['b']);
  });

  it('excludes the item itself (by id)', () => {
    const cols = getCollisions(layout, item('a', 0, 0, 2, 2));
    expect(cols.some((i) => i.id === 'a')).toBe(false);
  });

  it('returns empty array when nothing collides', () => {
    const cols = getCollisions(layout, item('z', 10, 10, 1, 1));
    expect(cols).toHaveLength(0);
  });

  it('returns multiple colliders', () => {
    const layout2: IGridLayout = [
      item('a', 0, 0, 3, 3),
      item('b', 1, 0, 1, 1),
      item('c', 2, 0, 1, 1),
    ];
    const cols = getCollisions(layout2, item('a', 0, 0, 3, 3));
    expect(cols.map((i) => i.id).sort()).toEqual(['b', 'c']);
  });
});

// ---------------------------------------------------------------------------
// clampToCols
// ---------------------------------------------------------------------------

describe('clampToCols', () => {
  it('item fits within cols → unchanged', () => {
    const result = clampToCols(item('a', 2, 0, 3, 2), 12);
    expect(result).toEqual(item('a', 2, 0, 3, 2));
  });

  it('x + w > cols → w reduced so x+w === cols', () => {
    // x=10, w=5 → x+w=15 > 12 → w clamped to 2
    const result = clampToCols(item('a', 10, 0, 5, 2), 12);
    expect(result.x).toBe(10);
    expect(result.w).toBe(2);
    expect(result.x + result.w).toBe(12);
  });

  it('x < 0 → x clamped to 0', () => {
    const result = clampToCols(item('a', -3, 0, 2, 2), 12);
    expect(result.x).toBe(0);
    expect(result.w).toBe(2);
  });

  it('x >= cols → x clamped to cols-1, w forced to 1', () => {
    // x=12 (= cols) → x=11, w clamped to 1
    const result = clampToCols(item('a', 12, 0, 3, 2), 12);
    expect(result.x).toBe(11);
    expect(result.w).toBe(1);
  });

  it('w < 1 → w forced to 1', () => {
    const result = clampToCols(item('a', 0, 0, 0, 2), 12);
    expect(result.w).toBe(1);
  });

  it('does not touch y or h', () => {
    const result = clampToCols(item('a', 0, 5, 2, 7), 12);
    expect(result.y).toBe(5);
    expect(result.h).toBe(7);
  });
});

// ---------------------------------------------------------------------------
// compactVertical
// ---------------------------------------------------------------------------

describe('compactVertical', () => {
  it('pulls items up with no gaps', () => {
    // Two items, second has gap above it → should be pulled to y=0 and y=2
    const layout: IGridLayout = [
      item('a', 0, 0, 2, 2),
      item('b', 2, 5, 2, 2), // gap of 3 rows between a and b (non-overlapping x)
    ];
    const result = compactVertical(layout, 12);
    const a = result.find((i) => i.id === 'a')!;
    const b = result.find((i) => i.id === 'b')!;
    expect(a.y).toBe(0);
    expect(b.y).toBe(0); // b starts at different x, so it can go to y=0
  });

  it('overlapping-x items stack vertically without gaps', () => {
    // a: x[0,2) y=0 h=2; b: x[0,2) y=10 h=2 — same x span, gap of 8 rows
    const layout: IGridLayout = [item('a', 0, 0, 2, 2), item('b', 0, 10, 2, 2)];
    const result = compactVertical(layout, 12);
    const a = result.find((i) => i.id === 'a')!;
    const b = result.find((i) => i.id === 'b')!;
    expect(a.y).toBe(0);
    expect(b.y).toBe(2); // immediately after a
  });

  it('empty layout → empty result', () => {
    expect(compactVertical([], 12)).toHaveLength(0);
  });

  it('single item → y becomes 0', () => {
    const result = compactVertical([item('a', 0, 5, 2, 2)], 12);
    expect(result[0].y).toBe(0);
  });

  it('three items in a column compact to consecutive rows', () => {
    const layout: IGridLayout = [
      item('a', 0, 0, 2, 1),
      item('b', 0, 5, 2, 1),
      item('c', 0, 10, 2, 1),
    ];
    const result = compactVertical(layout, 12);
    const sorted = [...result].sort((a, b) => a.y - b.y);
    expect(sorted[0].y).toBe(0);
    expect(sorted[1].y).toBe(1);
    expect(sorted[2].y).toBe(2);
  });

  it('preserves ids', () => {
    const layout: IGridLayout = [item('x', 0, 0, 1, 1), item('y', 0, 5, 1, 1)];
    const result = compactVertical(layout, 12);
    expect(result.map((i) => i.id).sort()).toEqual(['x', 'y']);
  });
});

// ---------------------------------------------------------------------------
// pointToCell
// ---------------------------------------------------------------------------

describe('pointToCell', () => {
  // Container: 1200×640 px, top-left at (0, 0)
  const containerRect = { left: 0, top: 0, width: 1200, height: 640 };
  const cols = 12;
  const rowHeight = 64;
  // Column width = 1200/12 = 100px per col

  it('maps center of first cell to {x:0, y:0}', () => {
    // Center of cell (0,0): x=50, y=32
    expect(pointToCell({ x: 50, y: 32 }, containerRect, cols, rowHeight)).toEqual({ x: 0, y: 0 });
  });

  it('maps into second column', () => {
    // x=150 → col 1 (150/100 = 1.5 → floor=1)
    expect(pointToCell({ x: 150, y: 32 }, containerRect, cols, rowHeight)).toEqual({ x: 1, y: 0 });
  });

  it('maps into second row', () => {
    // y=96 → row 1 (96/64 = 1.5 → floor=1)
    expect(pointToCell({ x: 50, y: 96 }, containerRect, cols, rowHeight)).toEqual({ x: 0, y: 1 });
  });

  it('maps arbitrary cell (5, 3)', () => {
    // x=550 → col 5; y=224 → row 3
    expect(pointToCell({ x: 550, y: 224 }, containerRect, cols, rowHeight)).toEqual({ x: 5, y: 3 });
  });

  it('clamps point left of container to x=0', () => {
    expect(pointToCell({ x: -50, y: 32 }, containerRect, cols, rowHeight)).toEqual({ x: 0, y: 0 });
  });

  it('clamps point right of container to x=cols-1', () => {
    expect(pointToCell({ x: 1500, y: 32 }, containerRect, cols, rowHeight)).toEqual({
      x: 11,
      y: 0,
    });
  });

  it('clamps point above container to y=0', () => {
    expect(pointToCell({ x: 50, y: -100 }, containerRect, cols, rowHeight)).toEqual({ x: 0, y: 0 });
  });

  it('point below container bottom snaps to last visible row (no upper bound on y)', () => {
    // y=700 → row 10 (700/64 = 10.9 → floor=10); container height doesn't bound y
    expect(pointToCell({ x: 50, y: 700 }, containerRect, cols, rowHeight)).toEqual({ x: 0, y: 10 });
  });

  it('works with non-zero container offset', () => {
    // Container at (200, 100), width 600, 6 cols → colWidth=100
    const offsetRect = { left: 200, top: 100, width: 600, height: 400 };
    // point (350, 200) → relX=150, relY=100 → col=1, row=1 (rowHeight=64→row=1)
    expect(pointToCell({ x: 350, y: 200 }, offsetRect, 6, 64)).toEqual({ x: 1, y: 1 });
  });

  it('snaps exactly on column boundary to the right column', () => {
    // x=100 exactly → relX=100 → 100/100=1.0 → floor=1 → col 1
    expect(pointToCell({ x: 100, y: 32 }, containerRect, cols, rowHeight)).toEqual({ x: 1, y: 0 });
  });
});

// ---------------------------------------------------------------------------
// moveItem
// ---------------------------------------------------------------------------

describe('moveItem — compact:none', () => {
  it('moves item to new position exactly', () => {
    const layout: IGridLayout = [item('a', 0, 0, 2, 2), item('b', 5, 0, 2, 2)];
    const result = moveItem(layout, 'a', { x: 5, y: 5 }, 12, 'none');
    const a = result.find((i) => i.id === 'a')!;
    expect(a.x).toBe(5);
    expect(a.y).toBe(5);
  });

  it('returns layout unchanged when id not found', () => {
    const layout: IGridLayout = [item('a', 0, 0, 2, 2)];
    const result = moveItem(layout, 'z', { x: 1, y: 1 }, 12, 'none');
    expect(result).toEqual(layout);
  });

  it('pushes overlapped neighbor down', () => {
    // a at (0,0,2,2); b at (0,0,2,2) — same spot as a will move to
    const layout: IGridLayout = [item('a', 0, 5, 2, 2), item('b', 0, 0, 2, 2)];
    // Move a to (0,0) — now a and b overlap
    const result = moveItem(layout, 'a', { x: 0, y: 0 }, 12, 'none');
    const a = result.find((i) => i.id === 'a')!;
    const b = result.find((i) => i.id === 'b')!;
    // a lands at y=0
    expect(a.y).toBe(0);
    // b is pushed below a: y >= a.y + a.h = 2
    expect(b.y).toBeGreaterThanOrEqual(2);
  });

  it('moved item lands exactly at target — neighbors yield, not the mover', () => {
    // Three-item layout; move 'c' into the spot occupied by 'a'
    const layout: IGridLayout = [
      item('a', 0, 0, 2, 2),
      item('b', 2, 0, 2, 2),
      item('c', 0, 4, 2, 2),
    ];
    const result = moveItem(layout, 'c', { x: 0, y: 0 }, 12, 'none');
    const c = result.find((i) => i.id === 'c')!;
    const a = result.find((i) => i.id === 'a')!;
    expect(c.x).toBe(0);
    expect(c.y).toBe(0);
    // a was displaced
    expect(a.y).toBeGreaterThanOrEqual(2);
  });

  it('clamps item x+w to cols when moved too far right', () => {
    const layout: IGridLayout = [item('a', 0, 0, 3, 2)];
    const result = moveItem(layout, 'a', { x: 11, y: 0 }, 12, 'none');
    const a = result.find((i) => i.id === 'a')!;
    // x clamped: 11+3=14>12 → w reduced to 1 so x+w=12
    expect(a.x + a.w).toBeLessThanOrEqual(12);
  });
});

describe('moveItem — compact:vertical', () => {
  it('compacts all items upward after move', () => {
    const layout: IGridLayout = [
      item('a', 0, 0, 2, 2),
      item('b', 0, 10, 2, 2), // large gap
    ];
    const result = moveItem(layout, 'a', { x: 5, y: 5 }, 12, 'vertical');
    // After compact, no item should have a y gap that could be closed
    const sorted = [...result].sort((a, b) => a.y - b.y);
    expect(sorted[0].y).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// resizeItem — the headline invariant
// ---------------------------------------------------------------------------

describe('resizeItem — compact:none', () => {
  it('headline invariant: x and y of resized item NEVER change', () => {
    const layout: IGridLayout = [
      item('a', 2, 3, 2, 2), // anchor
      item('b', 3, 4, 2, 2), // will be overlapped when a grows
    ];
    const result = resizeItem(layout, 'a', { w: 4, h: 4 }, 12, 'none');
    const a = result.find((i) => i.id === 'a')!;
    // x and y must be EXACTLY the original values
    expect(a.x).toBe(2);
    expect(a.y).toBe(3);
    // w and h updated
    expect(a.w).toBe(4);
    expect(a.h).toBe(4);
  });

  it('neighbor is displaced — not the resized item', () => {
    const layout: IGridLayout = [
      item('a', 0, 0, 2, 2),
      item('b', 0, 1, 2, 2), // overlaps a if a grows taller
    ];
    const result = resizeItem(layout, 'a', { w: 2, h: 4 }, 12, 'none');
    const a = result.find((i) => i.id === 'a')!;
    const b = result.find((i) => i.id === 'b')!;
    // a's position is fixed
    expect(a.x).toBe(0);
    expect(a.y).toBe(0);
    // b must have been pushed below a
    expect(b.y).toBeGreaterThanOrEqual(a.y + a.h);
  });

  it('grow width — neighbor to the right is displaced', () => {
    const layout: IGridLayout = [
      item('a', 0, 0, 2, 2),
      item('b', 2, 0, 2, 2), // immediately to the right; a growing to w=3 overlaps it
    ];
    const result = resizeItem(layout, 'a', { w: 3, h: 2 }, 12, 'none');
    const a = result.find((i) => i.id === 'a')!;
    const b = result.find((i) => i.id === 'b')!;
    expect(a.x).toBe(0);
    expect(a.y).toBe(0);
    expect(a.w).toBe(3);
    // b no longer overlaps a
    expect(collides(a, b)).toBe(false);
  });

  it('w is clamped so resized item does not overflow cols', () => {
    const layout: IGridLayout = [item('a', 10, 0, 1, 1)];
    // x=10, requesting w=5 → 10+5=15 > 12 → w clamped to 2
    const result = resizeItem(layout, 'a', { w: 5, h: 1 }, 12, 'none');
    const a = result.find((i) => i.id === 'a')!;
    expect(a.x).toBe(10);
    expect(a.x + a.w).toBeLessThanOrEqual(12);
  });

  it('w minimum is 1 even if 0 requested', () => {
    const layout: IGridLayout = [item('a', 0, 0, 3, 3)];
    const result = resizeItem(layout, 'a', { w: 0, h: 1 }, 12, 'none');
    const a = result.find((i) => i.id === 'a')!;
    expect(a.w).toBeGreaterThanOrEqual(1);
  });

  it('h minimum is 1 even if 0 requested', () => {
    const layout: IGridLayout = [item('a', 0, 0, 3, 3)];
    const result = resizeItem(layout, 'a', { w: 3, h: 0 }, 12, 'none');
    const a = result.find((i) => i.id === 'a')!;
    expect(a.h).toBeGreaterThanOrEqual(1);
  });

  it('returns layout unchanged when id not found', () => {
    const layout: IGridLayout = [item('a', 0, 0, 2, 2)];
    const result = resizeItem(layout, 'z', { w: 5, h: 5 }, 12, 'none');
    expect(result).toEqual(layout);
  });

  it('no-overlap resize — layout is returned with only w/h changed', () => {
    const layout: IGridLayout = [
      item('a', 0, 0, 2, 2),
      item('b', 6, 6, 2, 2), // far away, no collision risk
    ];
    const result = resizeItem(layout, 'a', { w: 3, h: 3 }, 12, 'none');
    const a = result.find((i) => i.id === 'a')!;
    const b = result.find((i) => i.id === 'b')!;
    expect(a.w).toBe(3);
    expect(a.h).toBe(3);
    // b untouched
    expect(b.x).toBe(6);
    expect(b.y).toBe(6);
  });
});

describe('resizeItem — compact:vertical', () => {
  it('compacts after resize', () => {
    const layout: IGridLayout = [item('a', 0, 0, 2, 2), item('b', 0, 10, 2, 2)];
    const result = resizeItem(layout, 'a', { w: 2, h: 3 }, 12, 'vertical');
    const sorted = [...result].sort((x, y) => x.y - y.y);
    expect(sorted[0].y).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// placeItem
// ---------------------------------------------------------------------------

describe('placeItem — compact:none', () => {
  it('inserts a new item into an empty layout', () => {
    const result = placeItem([], item('a', 0, 0, 2, 2), 12, 'none');
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(item('a', 0, 0, 2, 2));
  });

  it('inserts item and resolves overlaps', () => {
    const layout: IGridLayout = [item('b', 0, 0, 2, 2)];
    // Place 'a' on top of 'b'
    const result = placeItem(layout, item('a', 0, 0, 2, 2), 12, 'none');
    const a = result.find((i) => i.id === 'a')!;
    const b = result.find((i) => i.id === 'b')!;
    expect(a.x).toBe(0);
    expect(a.y).toBe(0);
    // b displaced
    expect(collides(a, b)).toBe(false);
  });

  it('re-placing an existing item replaces it (idempotent)', () => {
    const layout: IGridLayout = [item('a', 0, 0, 2, 2), item('b', 5, 5, 2, 2)];
    const result = placeItem(layout, item('a', 1, 1, 3, 3), 12, 'none');
    const aItems = result.filter((i) => i.id === 'a');
    expect(aItems).toHaveLength(1);
    expect(aItems[0].x).toBe(1);
    expect(aItems[0].y).toBe(1);
  });

  it('clamps placed item to cols', () => {
    const result = placeItem([], item('a', 11, 0, 5, 2), 12, 'none');
    const a = result[0];
    expect(a.x + a.w).toBeLessThanOrEqual(12);
  });

  it('single item with no overlaps — layout unchanged except item added', () => {
    const layout: IGridLayout = [item('b', 5, 0, 2, 2)];
    const result = placeItem(layout, item('a', 0, 0, 2, 2), 12, 'none');
    expect(result).toHaveLength(2);
    const a = result.find((i) => i.id === 'a')!;
    const b = result.find((i) => i.id === 'b')!;
    expect(a).toEqual(item('a', 0, 0, 2, 2));
    expect(b).toEqual(item('b', 5, 0, 2, 2));
  });
});

describe('placeItem — compact:vertical', () => {
  it('compacts upward after placement', () => {
    const layout: IGridLayout = [item('b', 0, 10, 2, 2)];
    const result = placeItem(layout, item('a', 5, 0, 2, 2), 12, 'vertical');
    const sorted = [...result].sort((a, b) => a.y - b.y);
    expect(sorted[0].y).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// End-to-end: resize-then-check no self-move (the formal bug fix)
// ---------------------------------------------------------------------------

describe('resizeItem formal bug fix: self does not move', () => {
  it('complex layout: resizing widget surrounded by neighbors — only neighbors yield', () => {
    /**
     * Layout:
     *   a: (0,0,3,2) — the widget being resized
     *   b: (3,0,3,2) — to the right of a
     *   c: (0,2,6,2) — below both
     *
     * Resize a to (5,3) — now overlaps b and c.
     * Expected: a stays at x=0,y=0; b and c are displaced.
     */
    const layout: IGridLayout = [
      item('a', 0, 0, 3, 2),
      item('b', 3, 0, 3, 2),
      item('c', 0, 2, 6, 2),
    ];
    const result = resizeItem(layout, 'a', { w: 5, h: 3 }, 12, 'none');
    const a = result.find((i) => i.id === 'a')!;
    const b = result.find((i) => i.id === 'b')!;
    const c = result.find((i) => i.id === 'c')!;

    // a is NEVER moved
    expect(a.x).toBe(0);
    expect(a.y).toBe(0);
    expect(a.w).toBe(5);
    expect(a.h).toBe(3);

    // b and c no longer overlap a
    expect(collides(a, b)).toBe(false);
    expect(collides(a, c)).toBe(false);
  });
});

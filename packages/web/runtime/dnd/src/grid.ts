/**
 * grid.ts — pure grid-math module for @omnifield/web-dnd.
 *
 * ADR 026 Phase 1: pure functions + types for a grid-canvas dashboard layout.
 * No Solid components, no DOM access, no reactive primitives — 100% jsdom-testable.
 *
 * Key invariants:
 * - resizeItem NEVER moves the resized item (x/y stay fixed); only w/h change.
 *   Overlapping neighbors are displaced downward to make room.
 * - compact:'none' (default) — displacement-only; authored x/y are preserved for
 *   items that are not displaced; holes are allowed.
 * - compact:'vertical' — after resolving collisions, compact all items upward
 *   (classic react-grid-layout style).
 * - clampToCols keeps every item within [0, cols) horizontally.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface IGridItem {
  id: string;
  /** Column index (0-based). */
  x: number;
  /** Row index (0-based). */
  y: number;
  /** Width in columns. */
  w: number;
  /** Height in rows. */
  h: number;
}

export type IGridLayout = IGridItem[];

// ---------------------------------------------------------------------------
// Exported helpers (also consumed directly by tests)
// ---------------------------------------------------------------------------

/**
 * Returns true when two grid items overlap (share at least one cell).
 * Touching but not overlapping (edge-adjacent) returns false.
 */
export function collides(a: IGridItem, b: IGridItem): boolean {
  if (a.id === b.id) return false;
  // Overlap on x axis: a.x < b.x+b.w && a.x+a.w > b.x
  // Overlap on y axis: a.y < b.y+b.h && a.y+a.h > b.y
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/**
 * Returns all items in the layout that collide with the given item.
 * The item itself is excluded (by id).
 */
export function getCollisions(layout: IGridLayout, item: IGridItem): IGridItem[] {
  return layout.filter((other) => collides(item, other));
}

/**
 * Clamp an item so that it stays within column bounds [0, cols).
 * - x is clamped to [0, cols-1].
 * - w is reduced so that x + w <= cols.
 * - w is at minimum 1.
 * y and h are not touched (grid can grow vertically without bound).
 */
export function clampToCols(item: IGridItem, cols: number): IGridItem {
  let { x, w } = item;
  if (x < 0) x = 0;
  if (x >= cols) x = cols - 1;
  if (w < 1) w = 1;
  if (x + w > cols) w = cols - x;
  return { ...item, x, w };
}

/**
 * Compact the layout vertically: move every item as far up as it can go
 * without colliding with already-placed items. Items are sorted by y then x
 * before compaction so the result is stable and deterministic.
 *
 * This is the 'vertical' compact strategy (classic react-grid-layout).
 */
export function compactVertical(layout: IGridLayout, cols: number): IGridLayout {
  // Sort by y, then x for stability
  const sorted = [...layout].sort((a, b) => a.y - b.y || a.x - b.x);
  const placed: IGridItem[] = [];

  for (const item of sorted) {
    let candidate = clampToCols({ ...item }, cols);

    // Push item up as far as possible without colliding with already-placed items
    candidate = { ...candidate, y: 0 };
    while (true) {
      const collision = placed.find((p) => collides(candidate, p));
      if (!collision) break;
      // Push below the collider
      candidate = { ...candidate, y: collision.y + collision.h };
    }

    placed.push(candidate);
  }

  return placed;
}

// ---------------------------------------------------------------------------
// px → grid-cell conversion
// ---------------------------------------------------------------------------

/**
 * Convert a viewport-coordinate point inside a container to a grid cell {x, y}.
 *
 * The point is clamped to the container bounds before conversion, so edge/outside
 * points snap to the nearest valid cell rather than producing negative or out-of-range
 * values. The result is always within [0, cols-1] × [0, ∞).
 *
 * @param point         Viewport-coordinate point {x, y}.
 * @param containerRect The container's bounding rect (left/top/width/height).
 * @param cols          Number of grid columns.
 * @param rowHeight     Height of one grid row in pixels.
 */
export function pointToCell(
  point: { x: number; y: number },
  containerRect: { left: number; top: number; width: number; height: number },
  cols: number,
  rowHeight: number,
): { x: number; y: number } {
  // Offset relative to container top-left
  const relX = point.x - containerRect.left;
  const relY = point.y - containerRect.top;

  // Column width in px
  const colWidth = containerRect.width / cols;

  // Raw cell indices (may be negative or out of range for edge/outside points)
  let cellX = Math.floor(relX / colWidth);
  let cellY = Math.floor(relY / rowHeight);

  // Clamp x to [0, cols-1]
  if (cellX < 0) cellX = 0;
  if (cellX >= cols) cellX = cols - 1;

  // Clamp y to [0, ∞) — grid grows downward without bound
  if (cellY < 0) cellY = 0;

  return { x: cellX, y: cellY };
}

// ---------------------------------------------------------------------------
// Collision resolution (displacement-only, no global compact)
// ---------------------------------------------------------------------------

/**
 * Push a single item down so it no longer collides with the given obstacle.
 * Only y is adjusted (push-down strategy).
 */
function pushDown(item: IGridItem, obstacle: IGridItem): IGridItem {
  return { ...item, y: obstacle.y + obstacle.h };
}

/**
 * Resolve all collisions caused by `anchor` in the layout by displacing the
 * items that overlap with it. Uses a recursive cascade: when item A is pushed
 * down to avoid anchor, items now colliding with A are also pushed down.
 *
 * The anchor item is never moved (its entry in the layout is replaced with the
 * clamped version). Only other items are displaced.
 *
 * compact:'none'  — displacement only; no global compaction after resolution.
 * compact:'vertical' — after displacement, compact everything upward.
 *
 * Returns a new layout (immutable).
 */
function resolveCollisions(
  layout: IGridLayout,
  anchor: IGridItem,
  cols: number,
  compact: 'none' | 'vertical',
): IGridLayout {
  // Build mutable working copy. Replace anchor's entry in place.
  const working: IGridItem[] = layout.map((item) => (item.id === anchor.id ? anchor : { ...item }));

  // BFS/queue-based cascade: whenever we push an item, recheck its new position.
  // Process in y-order so we push downward consistently.
  const changed = new Set<string>([anchor.id]);

  let iterations = 0;
  const MAX_ITER = layout.length * layout.length + 10; // safety cap

  while (changed.size > 0 && iterations++ < MAX_ITER) {
    const round = [...changed];
    changed.clear();

    for (const anchorId of round) {
      const anchorItem = working.find((i) => i.id === anchorId);
      if (!anchorItem) continue;

      for (const other of working) {
        if (other.id === anchorId) continue;
        if (!collides(anchorItem, other)) continue;

        // Displace `other` below `anchorItem`
        const pushed = pushDown(other, anchorItem);
        const idx = working.findIndex((i) => i.id === other.id);
        if (idx !== -1) {
          working[idx] = pushed;
          changed.add(pushed.id);
        }
      }
    }
  }

  if (compact === 'vertical') {
    return compactVertical(working, cols);
  }

  return working;
}

// ---------------------------------------------------------------------------
// Main operations
// ---------------------------------------------------------------------------

/**
 * Move an item in the layout to a new position {x, y}.
 *
 * The item is placed at `to` (clamped to cols), then any items it now overlaps
 * are displaced downward. With compact:'vertical', all items are compacted up
 * afterward.
 *
 * If the item id is not found, the layout is returned unchanged.
 */
export function moveItem(
  layout: IGridLayout,
  id: string,
  to: { x: number; y: number },
  cols: number,
  compact: 'none' | 'vertical',
): IGridLayout {
  const existing = layout.find((item) => item.id === id);
  if (!existing) return layout;

  const moved = clampToCols({ ...existing, x: to.x, y: to.y < 0 ? 0 : to.y }, cols);

  return resolveCollisions(layout, moved, cols, compact);
}

/**
 * Resize an item to {w, h}.
 *
 * INVARIANT: The resized item's x and y are NEVER changed. Only w and h are
 * updated. Any items that are now overlapped by the larger item are displaced
 * downward (they yield; the anchor stays put). With compact:'vertical', all
 * items compact upward after displacement.
 *
 * If the item id is not found, the layout is returned unchanged.
 */
export function resizeItem(
  layout: IGridLayout,
  id: string,
  size: { w: number; h: number },
  cols: number,
  compact: 'none' | 'vertical',
): IGridLayout {
  const existing = layout.find((item) => item.id === id);
  if (!existing) return layout;

  // w must be >= 1; h must be >= 1
  const w = Math.max(1, size.w);
  const h = Math.max(1, size.h);

  // Clamp width so the item does not overflow cols — x is fixed, only w may be reduced.
  const clampedW = existing.x + w > cols ? cols - existing.x : w;

  const resized: IGridItem = { ...existing, w: clampedW, h };

  return resolveCollisions(layout, resized, cols, compact);
}

/**
 * Place (materialize) a new item into the layout at its authored {x, y, w, h}.
 *
 * If the item id already exists in the layout, the existing entry is replaced.
 * Any items that overlap the new item are displaced downward. With
 * compact:'vertical', all items compact upward after displacement.
 */
export function placeItem(
  layout: IGridLayout,
  item: IGridItem,
  cols: number,
  compact: 'none' | 'vertical',
): IGridLayout {
  // Remove existing entry with the same id (idempotent re-place)
  const without = layout.filter((i) => i.id !== item.id);

  const clamped = clampToCols({ ...item, y: item.y < 0 ? 0 : item.y }, cols);

  return resolveCollisions([...without, clamped], clamped, cols, compact);
}

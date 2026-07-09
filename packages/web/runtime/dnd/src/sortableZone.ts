/**
 * createSortableGroup — geometric live multi-zone sortable.
 *
 * ADR 025: items are draggable-only; the ONLY droppable is the zone container.
 * No nested droppables → no shadowing bug. Insertion index is computed
 * geometrically from rects snapshotted at drag-start (resting positions).
 */

import { type Accessor, createEffect, createMemo, createSignal, onCleanup } from 'solid-js';
import { useDnD } from './context';
import { createDraggable } from './draggable';
import { createDroppable } from './droppable';
import type { DragData } from './types';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ISortableGroupOptions {
  /** Stable group id. Items can migrate between any zones in the group. */
  id: string;
}

export interface ISortableDropEvent {
  itemId: string;
  fromZone: string;
  fromIndex: number;
  toZone: string;
  toIndex: number;
}

export interface ISortableZoneOptions {
  /** Zone id, unique within the group. */
  id: string;
  /**
   * Primary axis for index calculation:
   * - 'x'    — horizontal row (compare by center.x)
   * - 'y'    — vertical column (center.y)
   * - 'grid' — wrap/2D: nearest center in 2D → linear index
   */
  axis: 'x' | 'y' | 'grid';
  /** Reactive ordered list of item ids currently in this zone. */
  items: Accessor<string[]>;
  /** Optional per-item extra drag data (for accepts/commit). */
  data?: (itemId: string) => DragData;
  /**
   * Whether this zone accepts the given item.
   * undefined → accepts all. false → zone shows "cannot-drop" state.
   */
  accepts?: (itemId: string, data: DragData) => boolean;
  /** Called when an item is committed to this zone at the given index. */
  onDrop: (e: ISortableDropEvent) => void;
}

export interface ISortableZone {
  /** Ref for the zone container element (measured for bounds, serves as droppable). */
  containerRef: (el: HTMLElement) => void;
  /** Create a drag-source binding for one item in this zone. */
  createItem: (itemId: string) => ISortableZoneItem;
  /** Whether the current active drag is targeting this zone. */
  isTarget: Accessor<boolean>;
  /** Live insertion index in this zone (null when not the target). */
  activeIndex: Accessor<number | null>;
  /** Whether the active drag is rejected by this zone's accepts predicate. */
  rejects: Accessor<boolean>;
  /**
   * True while a drag is active in this group AND this zone would accept the
   * dragged item — regardless of whether the pointer is currently over it.
   * Mirrors swap-mode's "soft highlight all accepting targets" UX: lets the
   * consumer highlight every eligible drop zone the instant a drag starts (e.g.
   * the empty `main` zone in a Matrix insert-mode layout), plus a stronger
   * highlight on the zone that is currently `isTarget`.
   *
   * Any descendant carrying `[data-dnd-cancel]` will not start a drag — use for
   * in-draggable controls like resize handles or buttons (see createDraggable).
   */
  canAccept: Accessor<boolean>;
}

export interface ISortableZoneItem {
  /** Ref for the item element (drag-source + measured for geometry). */
  ref: (el: HTMLElement) => void;
  isDragging: Accessor<boolean>;
  /**
   * Optional visual shift (px) for gap-animation in x/y zones.
   * Apply as `transform: translate(shift().x + 'px', shift().y + 'px')`.
   * Items before the active index → {0,0}; on/after → shift by dragged item size.
   * In 'grid' returns {0,0} — primary live-preview mechanism is the insertion marker.
   */
  shift: Accessor<{ x: number; y: number }>;
}

export interface ISortableGroup {
  /** Register a zone (container). */
  createZone: (opts: ISortableZoneOptions) => ISortableZone;
  /**
   * Live target of the active drag: where (zone + index) the item will land,
   * or null when the pointer is not over an accepting zone in this group.
   * Single source of truth — shared by all zones (drives marker + commit).
   */
  activeTarget: Accessor<{ zoneId: string; index: number } | null>;
  /** Id of the item being dragged in this group (or null). */
  activeItemId: Accessor<string | null>;
}

// ---------------------------------------------------------------------------
// Pure geometric helpers (unit-testable, no DOM dependencies)
// ---------------------------------------------------------------------------

export interface IRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

/**
 * Compute the insertion index (0..items.length) for a pointer position
 * given an array of item rects (resting positions, in the same coordinate space
 * as `point`). Pure function — no DOM access.
 *
 * axis 'x': compare by center.x, return index of first item whose center.x > point.x
 * axis 'y': compare by center.y, return index of first item whose center.y > point.y
 * axis 'grid': nearest item center in 2D → use that item's index as anchor,
 *              then refine by the primary axis (x first, then y for tiebreak) to
 *              decide whether to insert before or after that item.
 *
 * Edge cases:
 * - empty array → always returns 0
 * - pointer before all items → 0
 * - pointer after all items → items.length
 */
export function computeInsertIndex(
  point: { x: number; y: number },
  axis: 'x' | 'y' | 'grid',
  itemRects: IRect[],
): number {
  const n = itemRects.length;
  if (n === 0) return 0;

  if (axis === 'x') {
    // Find first item whose center.x is to the right of the pointer
    for (let i = 0; i < n; i++) {
      const cx = (itemRects[i].left + itemRects[i].right) / 2;
      if (point.x < cx) return i;
    }
    return n;
  }

  if (axis === 'y') {
    // Find first item whose center.y is below the pointer
    for (let i = 0; i < n; i++) {
      const cy = (itemRects[i].top + itemRects[i].bottom) / 2;
      if (point.y < cy) return i;
    }
    return n;
  }

  // axis === 'grid': nearest center in 2D, then decide before/after
  let nearestIdx = 0;
  let nearestDist = Number.POSITIVE_INFINITY;
  for (let i = 0; i < n; i++) {
    const cx = (itemRects[i].left + itemRects[i].right) / 2;
    const cy = (itemRects[i].top + itemRects[i].bottom) / 2;
    const dx = point.x - cx;
    const dy = point.y - cy;
    const dist = dx * dx + dy * dy;
    if (dist < nearestDist) {
      nearestDist = dist;
      nearestIdx = i;
    }
  }

  // Decide insert before or after the nearest item
  const nr = itemRects[nearestIdx];
  const ncx = (nr.left + nr.right) / 2;
  const ncy = (nr.top + nr.bottom) / 2;

  // Primary tiebreak by x (horizontal position), secondary by y
  if (point.x < ncx) return nearestIdx;
  if (point.x > ncx) return nearestIdx + 1;
  // x is equal (or very close) — fall back to y
  if (point.y < ncy) return nearestIdx;
  return nearestIdx + 1;
}

/**
 * Find which zone container (by bounding rect) contains the pointer.
 * Returns the zone id, or null if the pointer is outside all containers.
 */
export function findZoneAtPoint(
  point: { x: number; y: number },
  zoneRects: Array<{ id: string; rect: IRect }>,
): string | null {
  for (const { id, rect } of zoneRects) {
    if (
      point.x >= rect.left &&
      point.x <= rect.right &&
      point.y >= rect.top &&
      point.y <= rect.bottom
    ) {
      return id;
    }
  }
  return null;
}

/**
 * Find the nearest zone by center distance among the given candidates.
 * Used as fallback when the pointer is outside all zone containers.
 */
export function findNearestZone(
  point: { x: number; y: number },
  zoneRects: Array<{ id: string; rect: IRect }>,
): string | null {
  if (zoneRects.length === 0) return null;
  let nearestId = zoneRects[0].id;
  let nearestDist = Number.POSITIVE_INFINITY;
  for (const { id, rect } of zoneRects) {
    const cx = (rect.left + rect.right) / 2;
    const cy = (rect.top + rect.bottom) / 2;
    const dx = point.x - cx;
    const dy = point.y - cy;
    const dist = dx * dx + dy * dy;
    if (dist < nearestDist) {
      nearestDist = dist;
      nearestId = id;
    }
  }
  return nearestId;
}

// ---------------------------------------------------------------------------
// Internal snapshot types
// ---------------------------------------------------------------------------

interface IZoneSnapshot {
  rect: IRect;
  itemRects: Array<{ id: string; rect: IRect }>;
}

interface IZoneEntry {
  opts: ISortableZoneOptions;
  el: HTMLElement | null;
}

interface IItemEntry {
  zoneId: string;
  el: HTMLElement | null;
}

// ---------------------------------------------------------------------------
// createSortableGroup
// ---------------------------------------------------------------------------

export function createSortableGroup(opts: ISortableGroupOptions): ISortableGroup {
  const dnd = useDnD();

  // Non-reactive registries (mutations do not need to trigger re-renders)
  const zones = new Map<string, IZoneEntry>();
  const items = new Map<string, IItemEntry>();

  // Reactive signals
  const [activeItemId, setActiveItemId] = createSignal<string | null>(null);
  const [activeTarget, setActiveTarget] = createSignal<{ zoneId: string; index: number } | null>(
    null,
  );

  // Snapshot taken on drag start (resting positions). Cleared on drag end.
  let snapshot: Map<string, IZoneSnapshot> | null = null;

  // Draggable id prefix for items in this group
  const draggablePrefix = `sortable-group:${opts.id}:`;

  // ---------------------------------------------------------------------------
  // Snapshot logic
  // ---------------------------------------------------------------------------

  function takeSnapshot(): Map<string, IZoneSnapshot> {
    const snap = new Map<string, IZoneSnapshot>();
    for (const [zoneId, zoneEntry] of zones) {
      if (!zoneEntry.el) continue;
      const zoneRect = zoneEntry.el.getBoundingClientRect();
      const containerRect: IRect = {
        left: zoneRect.left,
        top: zoneRect.top,
        right: zoneRect.right,
        bottom: zoneRect.bottom,
        width: zoneRect.width,
        height: zoneRect.height,
      };
      const itemOrder = zoneEntry.opts.items();
      const itemRects: Array<{ id: string; rect: IRect }> = [];
      for (const itemId of itemOrder) {
        const itemEntry = items.get(itemId);
        if (!itemEntry?.el) continue;
        const r = itemEntry.el.getBoundingClientRect();
        itemRects.push({
          id: itemId,
          rect: {
            left: r.left,
            top: r.top,
            right: r.right,
            bottom: r.bottom,
            width: r.width,
            height: r.height,
          },
        });
      }
      snap.set(zoneId, { rect: containerRect, itemRects });
    }
    return snap;
  }

  function clearSnapshot() {
    snapshot = null;
    setActiveTarget(null);
    setActiveItemId(null);
  }

  // ---------------------------------------------------------------------------
  // Active drag tracking: snapshot on drag start, clear on drag end
  // ---------------------------------------------------------------------------

  createEffect(() => {
    const currentActiveId = dnd.state.activeId();
    if (!currentActiveId) {
      clearSnapshot();
      return;
    }

    // Check if this drag belongs to our group
    if (!currentActiveId.startsWith(draggablePrefix)) return;

    const rawItemId = currentActiveId.slice(draggablePrefix.length);
    setActiveItemId(rawItemId);
    snapshot = takeSnapshot();
  });

  // ---------------------------------------------------------------------------
  // Pointer tracking: compute target zone + insertion index
  // ---------------------------------------------------------------------------

  createEffect(() => {
    const pt = dnd.state.pointer();
    const aidRaw = activeItemId();

    if (!pt || !aidRaw || !snapshot) {
      // Only clear activeTarget if we're still in an active drag
      // (avoids clearing on initial render before drag starts)
      if (aidRaw === null) setActiveTarget(null);
      return;
    }

    // Build list of zone rects from snapshot
    const zoneRectList: Array<{ id: string; rect: IRect }> = [];
    for (const [zoneId, zoneSnap] of snapshot) {
      zoneRectList.push({ id: zoneId, rect: zoneSnap.rect });
    }

    // Determine which zone the pointer is in (or nearest accepting)
    const containingZoneId = findZoneAtPoint(pt, zoneRectList);

    // Resolve candidate zone: if pointer is in a zone, check accepts; otherwise nearest accepting
    let targetZoneId: string | null = null;

    if (containingZoneId) {
      const zoneEntry = zones.get(containingZoneId);
      const activeData = dnd.state.activeData();
      const zoneAccepts =
        !zoneEntry?.opts.accepts || (activeData && zoneEntry.opts.accepts(aidRaw, activeData));

      if (zoneAccepts) {
        targetZoneId = containingZoneId;
      } else {
        // Pointer is over a rejecting zone — signal rejection but no target
        setActiveTarget(null);
        return;
      }
    } else {
      // Pointer outside all zone containers — find nearest accepting zone
      const acceptingZones = zoneRectList.filter(({ id }) => {
        const zoneEntry = zones.get(id);
        const activeData = dnd.state.activeData();
        return (
          !zoneEntry?.opts.accepts || (activeData && zoneEntry.opts.accepts(aidRaw, activeData))
        );
      });
      targetZoneId = findNearestZone(pt, acceptingZones);
    }

    if (!targetZoneId) {
      setActiveTarget(null);
      return;
    }

    const zoneEntry = zones.get(targetZoneId);
    const zoneSnap = snapshot.get(targetZoneId);
    if (!zoneEntry || !zoneSnap) {
      setActiveTarget(null);
      return;
    }

    // Compute insertion index geometrically
    // Filter out the dragged item's rect (it's being moved, don't count it)
    const filteredRects = zoneSnap.itemRects.filter((ir) => ir.id !== aidRaw).map((ir) => ir.rect);

    const index = computeInsertIndex(pt, zoneEntry.opts.axis, filteredRects);
    setActiveTarget({ zoneId: targetZoneId, index });
  });

  // ---------------------------------------------------------------------------
  // createZone
  // ---------------------------------------------------------------------------

  function createZone(zoneOpts: ISortableZoneOptions): ISortableZone {
    // Register zone entry
    const entry: IZoneEntry = { opts: zoneOpts, el: null };
    zones.set(zoneOpts.id, entry);

    // Zone-level droppable. The container is the ONLY droppable — items are not.
    const droppable = createDroppable({
      id: `sortable-group:${opts.id}:zone:${zoneOpts.id}`,
      accepts: (data: DragData) => {
        const aidRaw = activeItemId();
        if (!aidRaw) return false;
        return !zoneOpts.accepts || zoneOpts.accepts(aidRaw, data);
      },
      onDrop: (_data: DragData) => {
        const target = activeTarget();
        const aidRaw = activeItemId();
        if (!target || !aidRaw) return;
        if (target.zoneId !== zoneOpts.id) return;

        // Find fromZone + fromIndex
        const itemEntry = items.get(aidRaw);
        if (!itemEntry) return;
        const fromZone = itemEntry.zoneId;
        const fromZoneEntry = zones.get(fromZone);
        const fromIndex = fromZoneEntry ? fromZoneEntry.opts.items().indexOf(aidRaw) : -1;

        zoneOpts.onDrop({
          itemId: aidRaw,
          fromZone,
          fromIndex,
          toZone: zoneOpts.id,
          toIndex: target.index,
        });
      },
    });

    // containerRef: register element + droppable
    const containerRef = (el: HTMLElement) => {
      entry.el = el || null;
      droppable.ref(el);
      if (el) {
        onCleanup(() => {
          if (entry.el === el) entry.el = null;
        });
      }
    };

    // Derived signals for this zone
    const isTarget: Accessor<boolean> = createMemo(() => activeTarget()?.zoneId === zoneOpts.id);

    const activeIndex: Accessor<number | null> = createMemo(() => {
      const t = activeTarget();
      return t?.zoneId === zoneOpts.id ? t.index : null;
    });

    const rejects: Accessor<boolean> = createMemo(() => {
      const aidRaw = activeItemId();
      if (!aidRaw) return false;
      const activeData = dnd.state.activeData();
      const pt = dnd.state.pointer();
      if (!pt || !snapshot) return false;

      // Pointer must be inside this zone's container
      const zoneSnap = snapshot.get(zoneOpts.id);
      if (!zoneSnap) return false;
      const r = zoneSnap.rect;
      const inZone = pt.x >= r.left && pt.x <= r.right && pt.y >= r.top && pt.y <= r.bottom;
      if (!inZone) return false;

      // Zone is rejecting if it has an accepts predicate and it returns false
      return !!(zoneOpts.accepts && activeData && !zoneOpts.accepts(aidRaw, activeData));
    });

    // True while a drag is active in this group AND this zone would accept the
    // dragged item — independent of pointer position. Drives "soft highlight all
    // accepting zones" UX (mirrors swap-mode behavior in Matrix insert mode).
    const canAccept: Accessor<boolean> = createMemo(() => {
      const aidRaw = activeItemId();
      if (!aidRaw) return false;
      if (!zoneOpts.accepts) return true; // no predicate → accepts all
      const activeData = dnd.state.activeData();
      if (!activeData) return false;
      return zoneOpts.accepts(aidRaw, activeData);
    });

    // createItem: item is draggable-only (NOT droppable — this is the key design)
    function createItem(itemId: string): ISortableZoneItem {
      // Register item
      const itemEntry: IItemEntry = { zoneId: zoneOpts.id, el: null };
      items.set(itemId, itemEntry);

      const draggableId = `${draggablePrefix}${itemId}`;
      const draggable = createDraggable({
        id: draggableId,
        data: () => ({
          __sortableGroup: opts.id,
          itemId,
          zoneId: zoneOpts.id,
          ...(zoneOpts.data ? zoneOpts.data(itemId) : {}),
        }),
      });

      const itemRef = (el: HTMLElement) => {
        itemEntry.el = el || null;
        draggable.ref(el);
        if (el) {
          onCleanup(() => {
            if (itemEntry.el === el) itemEntry.el = null;
          });
        }
      };

      const isDragging: Accessor<boolean> = draggable.isDragging;

      // Shift: for x/y zones, items at/after activeIndex shift by the dragged item's size
      const shift: Accessor<{ x: number; y: number }> = createMemo(() => {
        const target = activeTarget();
        if (!target || target.zoneId !== zoneOpts.id) return { x: 0, y: 0 };
        if (zoneOpts.axis === 'grid') return { x: 0, y: 0 };

        const aidRaw = activeItemId();
        if (!aidRaw || !snapshot) return { x: 0, y: 0 };

        const zoneSnap = snapshot.get(zoneOpts.id);
        if (!zoneSnap) return { x: 0, y: 0 };

        // Find this item's position in the resting order (excluding dragged item)
        const filteredItems = zoneSnap.itemRects.filter((ir) => ir.id !== aidRaw);
        const thisItemIdx = filteredItems.findIndex((ir) => ir.id === itemId);
        if (thisItemIdx === -1) return { x: 0, y: 0 };

        // Items before the insertion index don't shift; items at/after do
        if (thisItemIdx < target.index) return { x: 0, y: 0 };

        // Get dragged item's dimensions from snapshot
        const draggedSnap = zoneSnap.itemRects.find((ir) => ir.id === aidRaw);
        if (!draggedSnap) return { x: 0, y: 0 };

        if (zoneOpts.axis === 'x') {
          return { x: draggedSnap.rect.width, y: 0 };
        }
        // axis === 'y'
        return { x: 0, y: draggedSnap.rect.height };
      });

      onCleanup(() => {
        if (items.get(itemId) === itemEntry) items.delete(itemId);
      });

      return { ref: itemRef, isDragging, shift };
    }

    onCleanup(() => {
      if (zones.get(zoneOpts.id) === entry) zones.delete(zoneOpts.id);
    });

    return { containerRef, createItem, isTarget, activeIndex, rejects, canAccept };
  }

  return { createZone, activeTarget, activeItemId };
}

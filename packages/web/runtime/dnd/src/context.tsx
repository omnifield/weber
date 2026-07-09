import {
  type Accessor,
  type Component,
  createContext,
  createMemo,
  createSignal,
  onCleanup,
  Show,
  useContext,
} from 'solid-js';
import { Portal } from 'solid-js/web';
import { createWindowAutoScroll } from './autoScroll';
import type {
  DragData,
  DraggableId,
  DroppableId,
  IDnDProviderProps,
  IDraggableEntry,
  IDragSnapshot,
  IDropInfo,
  IDroppableEntry,
  IPoint,
} from './types';

interface IDnDContext {
  state: {
    activeId: Accessor<DraggableId | null>;
    activeData: Accessor<DragData | null>;
    pointer: Accessor<IPoint | null>;
    overId: Accessor<DroppableId | null>;
    canDrop: Accessor<boolean>;
  };
  /** Порог активации drag'а в px. Берётся из IDnDProviderProps.activationDistance. */
  activationDistance: number;
  registerDraggable: (entry: IDraggableEntry) => () => void;
  registerDroppable: (entry: IDroppableEntry) => () => void;
  startDrag: (id: DraggableId, e: PointerEvent) => void;
}

const Ctx = createContext<IDnDContext>();

/**
 * Built-in drag ghost rendered when `showDefaultOverlay` is true.
 *
 * Режимы задаются через `overlayMode` на DnDProvider:
 * - `'clone'`     (default) — полноразмерный полупрозрачный клон.
 * - `'thumbnail'` — уменьшенный клон (scale=overlayScale), центрирован под курсором.
 * - `'mini'`      — маленький 48×48 indigo-box (legacy).
 */
const DefaultDragOverlay = (innerProps: {
  pointer: Accessor<IPoint | null>;
  activeData: Accessor<DragData | null>;
  snapshot: Accessor<IDragSnapshot | null>;
  mode: 'clone' | 'thumbnail' | 'mini';
  scale: number;
}) => {
  return (
    <Show when={innerProps.activeData() && innerProps.pointer()}>
      <Show
        when={
          (innerProps.mode === 'clone' || innerProps.mode === 'thumbnail') && innerProps.snapshot()
        }
        fallback={
          /* mini — legacy 48×48 box */
          <Portal>
            <div
              style={{
                position: 'fixed',
                left: `${innerProps.pointer()!.x}px`,
                top: `${innerProps.pointer()!.y}px`,
                transform: 'translate(-50%, -50%)',
                width: '48px',
                height: '48px',
                'border-radius': '8px',
                background: 'rgba(99,102,241,0.35)',
                border: '2px solid rgba(99,102,241,0.7)',
                'pointer-events': 'none',
                'z-index': '9999',
                'backdrop-filter': 'blur(2px)',
              }}
            />
          </Portal>
        }
      >
        <Show
          when={innerProps.mode === 'thumbnail'}
          fallback={
            /* clone — полноразмерный ghost с offset'ом захвата */
            <Portal>
              <div
                style={{
                  position: 'fixed',
                  left: `${innerProps.pointer()!.x - innerProps.snapshot()!.offsetX}px`,
                  top: `${innerProps.pointer()!.y - innerProps.snapshot()!.offsetY}px`,
                  width: `${innerProps.snapshot()!.width}px`,
                  height: `${innerProps.snapshot()!.height}px`,
                  opacity: '0.6',
                  'pointer-events': 'none',
                  'z-index': '9999',
                  transform: 'scale(0.97)',
                  'transform-origin': 'top left',
                  'box-shadow': '0 8px 24px rgba(0,0,0,0.18)',
                  'border-radius': '4px',
                  overflow: 'hidden',
                }}
                ref={(el) => {
                  const snap = innerProps.snapshot();
                  if (snap) el.appendChild(snap.clone);
                }}
              />
            </Portal>
          }
        >
          {/* thumbnail — уменьшенный клон, центрирован под курсором */}
          <Portal>
            <div
              style={{
                position: 'fixed',
                // Позиционируем top-left угла контейнера так, чтобы после scale
                // scaled-блок (width*scale × height*scale) был центрирован под pointer'ом.
                // transform-origin: top left → визуальный центр = left + (w*scale)/2, top + (h*scale)/2.
                left: `${innerProps.pointer()!.x - (innerProps.snapshot()!.width * innerProps.scale) / 2}px`,
                top: `${innerProps.pointer()!.y - (innerProps.snapshot()!.height * innerProps.scale) / 2}px`,
                width: `${innerProps.snapshot()!.width}px`,
                height: `${innerProps.snapshot()!.height}px`,
                'pointer-events': 'none',
                'z-index': '9999',
                transform: `scale(${innerProps.scale})`,
                'transform-origin': 'top left',
                'box-shadow': '0 12px 32px rgba(0,0,0,0.30)',
                border: '2px solid oklch(var(--primary, 0.5 0.2 260))',
                'border-radius': '8px',
                overflow: 'hidden',
                // oklch(var(--background)) is unreliable — var resolves to channel
                // values, not a full color, so the composite is often transparent.
                // Use an explicit opaque fallback that works in both light/dark.
                background: 'var(--card, #ffffff)',
              }}
              ref={(el) => {
                const snap = innerProps.snapshot();
                if (snap) el.appendChild(snap.clone);
              }}
            />
          </Portal>
        </Show>
      </Show>
    </Show>
  );
};

export const useDnD = (): IDnDContext => {
  const ctx = useContext(Ctx);
  if (!ctx) {
    throw new Error('[@omnifield/dnd] useDnD must be used inside <DnDProvider>');
  }
  return ctx;
};

export const DnDProvider: Component<IDnDProviderProps> = (props) => {
  const [activeId, setActiveId] = createSignal<DraggableId | null>(null);
  const [activeData, setActiveData] = createSignal<DragData | null>(null);
  const [pointer, setPointer] = createSignal<IPoint | null>(null);
  const [overId, setOverId] = createSignal<DroppableId | null>(null);
  const [dragSnapshot, setDragSnapshot] = createSignal<IDragSnapshot | null>(null);

  // Не реактивные реестры — изменения не должны триггерить ре-рендер всех
  // потребителей контекста. Реактивность отдельных полей даёт signals выше.
  const draggables = new Map<DraggableId, IDraggableEntry>();
  const droppables = new Map<DroppableId, IDroppableEntry>();
  const elToDroppableId = new WeakMap<HTMLElement, DroppableId>();

  // No pointer capture state needed — we use window-level listeners exclusively.
  // setPointerCapture was removed because it redirects document.elementFromPoint
  // to always return the captured element, breaking droppable hit-testing during
  // a drag started externally (e.g. from DragBadge calling dnd.startDrag).
  // Window-level pointermove/pointerup cover all cases without this side-effect.

  const findDroppableAt = (x: number, y: number): IDroppableEntry | null => {
    let el = document.elementFromPoint(x, y) as HTMLElement | null;
    while (el) {
      const id = elToDroppableId.get(el);
      if (id) return droppables.get(id) ?? null;
      el = el.parentElement;
    }
    return null;
  };

  const canDrop = createMemo(() => {
    const data = activeData();
    const oid = overId();
    if (!data || !oid) return false;
    const drop = droppables.get(oid);
    if (!drop) return false;
    return drop.accepts(data);
  });

  const onPointerMove = (e: PointerEvent) => {
    setPointer({ x: e.clientX, y: e.clientY });
    const drop = findDroppableAt(e.clientX, e.clientY);
    setOverId(drop?.id ?? null);
  };

  const onPointerUp = (e: PointerEvent) => {
    const data = activeData();
    const id = activeId();
    if (!data || !id) {
      cleanup();
      return;
    }
    const drop = findDroppableAt(e.clientX, e.clientY);
    if (drop?.accepts(data)) {
      const rect = drop.el.getBoundingClientRect();
      const info: IDropInfo = {
        draggableId: id,
        droppableId: drop.id,
        pointer: { x: e.clientX, y: e.clientY },
        ratio: {
          x: rect.width ? (e.clientX - rect.left) / rect.width : 0,
          y: rect.height ? (e.clientY - rect.top) / rect.height : 0,
        },
      };
      drop.onDrop?.(data, info);
      props.onDragEnd?.({ kind: 'drop', data, info });
    } else {
      props.onDragEnd?.({ kind: 'cancel', data, draggableId: id });
    }
    cleanup();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return;
    const data = activeData();
    const id = activeId();
    if (data && id) {
      props.onDragEnd?.({ kind: 'cancel', data, draggableId: id });
    }
    cleanup();
  };

  const cleanup = () => {
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('pointercancel', onPointerUp);
    window.removeEventListener('keydown', onKeyDown);
    setActiveId(null);
    setActiveData(null);
    setPointer(null);
    setOverId(null);
    // Клон DOM более не нужен: убрать из памяти до того как signal обнулится.
    // Сам Portal-div удалит дочерний элемент через onCleanup при Show=false.
    setDragSnapshot(null);
  };

  // Defensive: if DnDProvider unmounts during an active drag (e.g. route change
  // mid-drag), the 4 window-level listeners must be removed. Without this,
  // each interrupted drag leaks +4 orphan listeners holding signal closures.
  onCleanup(cleanup);

  const startDrag = (id: DraggableId, e: PointerEvent) => {
    const entry = draggables.get(id);
    if (!entry) return;
    // Do NOT call setPointerCapture here. Pointer capture redirects
    // document.elementFromPoint to always return the captured element,
    // which breaks droppable hit-testing in findDroppableAt. Window-level
    // listeners are sufficient to track pointermove/up regardless of what
    // element the user is physically hovering.
    const data = entry.data();
    setActiveId(id);
    setActiveData(data);
    setPointer({ x: e.clientX, y: e.clientY });
    props.onDragStart?.(data, id);

    // Capture clone snapshot для clone/thumbnail-mode overlay.
    // Делаем только когда overlay будет показан, чтобы не тратить ресурсы
    // при showDefaultOverlay=false или overlayMode='mini'/'none'.
    const mode = props.overlayMode ?? 'clone';
    if (props.showDefaultOverlay && (mode === 'clone' || mode === 'thumbnail')) {
      const el = entry.el;
      const rect = el.getBoundingClientRect();
      const clone = el.cloneNode(true) as HTMLElement;
      // Сбросить inline size клона чтобы он не сжимался внутри fixed-контейнера.
      clone.style.width = `${rect.width}px`;
      clone.style.height = `${rect.height}px`;
      // Убрать pointer-events у клона — overlay уже имеет pointer-events:none.
      clone.style.pointerEvents = 'none';

      // canvas pixel buffer не копируется через cloneNode — WebGL context
      // привязан к оригиналу. Конвертируем каждый canvas в <img> через toDataURL,
      // при ошибке (tainted/CORS/preserveDrawingBuffer=false) ставим placeholder.
      const origCanvases = el.querySelectorAll('canvas');
      const cloneCanvases = clone.querySelectorAll('canvas');
      origCanvases.forEach((orig, i) => {
        const cloneCanvas = cloneCanvases[i];
        if (!cloneCanvas) return;
        try {
          const dataUrl = orig.toDataURL('image/png');
          const img = document.createElement('img');
          img.src = dataUrl;
          img.style.width = `${orig.clientWidth}px`;
          img.style.height = `${orig.clientHeight}px`;
          img.style.objectFit = 'contain';
          img.style.display = 'block';
          cloneCanvas.replaceWith(img);
        } catch (_e) {
          // toDataURL may throw on tainted/CORS canvas or when
          // preserveDrawingBuffer=false (WebGL) → slate placeholder.
          const ph = document.createElement('div');
          ph.style.width = `${orig.clientWidth}px`;
          ph.style.height = `${orig.clientHeight}px`;
          ph.style.background = '#94a3b8';
          ph.style.display = 'flex';
          ph.style.alignItems = 'center';
          ph.style.justifyContent = 'center';
          ph.style.color = 'white';
          ph.style.fontSize = '14px';
          ph.textContent = 'Canvas';
          cloneCanvas.replaceWith(ph);
        }
      });

      setDragSnapshot({
        width: rect.width,
        height: rect.height,
        clone,
        // Смещение от левого верхнего угла элемента до cursor'а в момент захвата.
        offsetX: e.clientX - rect.left,
        offsetY: e.clientY - rect.top,
      });
    }

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    window.addEventListener('keydown', onKeyDown);
  };

  // Auto-scroll по краям viewport. Активен только при активном drag'е, если
  // включено через `<DnDProvider autoScroll>`.
  if (props.autoScroll) {
    createWindowAutoScroll(pointer, () => activeId() !== null);
  }

  const api: IDnDContext = {
    state: { activeId, activeData, pointer, overId, canDrop },
    activationDistance: props.activationDistance ?? 4,
    registerDraggable: (entry) => {
      draggables.set(entry.id, entry);
      return () => {
        draggables.delete(entry.id);
      };
    },
    registerDroppable: (entry) => {
      droppables.set(entry.id, entry);
      elToDroppableId.set(entry.el, entry.id);
      return () => {
        droppables.delete(entry.id);
        elToDroppableId.delete(entry.el);
      };
    },
    startDrag,
  };

  return (
    <Ctx.Provider value={api}>
      {props.children}
      <Show when={props.showDefaultOverlay && (props.overlayMode ?? 'clone') !== 'none'}>
        <DefaultDragOverlay
          pointer={pointer}
          activeData={activeData}
          snapshot={dragSnapshot}
          mode={(props.overlayMode ?? 'clone') as 'clone' | 'thumbnail' | 'mini'}
          scale={Math.min(1.0, Math.max(0.1, props.overlayScale ?? 0.4))}
        />
      </Show>
    </Ctx.Provider>
  );
};

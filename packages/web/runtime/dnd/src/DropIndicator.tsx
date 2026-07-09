/**
 * DropIndicator — визуал позиции вставки для reorder (web-dnd владеет стилем).
 *
 * Рендерится внутри `position:relative`-обёртки строки. По `zone`:
 *  - `before` / `after` — жирная линия-сепаратор (primary, 3px, скруглённая) с
 *    точкой-маркером слева, обведённой фоном; straddles верхний / нижний край;
 *  - `inside` — кольцо + полупрозрачная заливка primary вокруг цели.
 *
 * ⚠️ **Стиль — инлайн, не Tailwind-классы (намеренно).** Консюмер-приложение
 * сканирует Tailwind только по своему `src` + `web-ui` (`@source`), НЕ по web-dnd
 * / web-studio. Классы вроде `h-[3px]` / `-top-[3px]` / `bg-primary/10` из
 * пакета НЕ попадали в билд → линия была `height:auto` (невидима), хотя `onDrop`
 * отрабатывал. Инлайн-стили на `var(--primary)` (полный oklch-цвет в темах)
 * делают индикатор самодостаточным и видимым в любом консюмере без `@source`.
 * Это корневой фикс «индикатор не показывается» из брифа.
 *
 * Требование к консюмеру: обёртка = `position: relative` и НЕ клипит потомков
 * (`overflow: visible`), иначе straddling-линия обрежется по краю.
 */

import { Show } from 'solid-js';
import type { DropZone } from './zone';

// Полный цвет из темы (в weber темах `--primary` = готовый oklch, не каналы).
const PRIMARY = 'var(--primary, oklch(0.3012 0 0))';
// Фон под точкой-маркером — чтобы линия «прерывалась» вокруг неё.
const BG = 'var(--background, #ffffff)';

const Separator = (props: { edge: 'top' | 'bottom' }) => (
  <div
    style={{
      position: 'absolute',
      left: '0',
      right: '0',
      [props.edge]: '0',
      // straddle края строки (центр линии = граница между строками).
      transform: props.edge === 'top' ? 'translateY(-50%)' : 'translateY(50%)',
      display: 'flex',
      'align-items': 'center',
      'pointer-events': 'none',
      'z-index': '20',
    }}
  >
    {/* точка-маркер слева, обведённая фоном */}
    <span
      style={{
        width: '8px',
        height: '8px',
        'flex-shrink': '0',
        'border-radius': '9999px',
        background: PRIMARY,
        'box-shadow': `0 0 0 2px ${BG}`,
      }}
    />
    {/* линия-сепаратор */}
    <span
      style={{
        height: '3px',
        flex: '1',
        'margin-left': '-4px',
        'border-radius': '9999px',
        background: PRIMARY,
      }}
    />
  </div>
);

export const DropIndicator = (props: { zone: DropZone | null }) => {
  return (
    <>
      <Show when={props.zone === 'before'}>
        <Separator edge="top" />
      </Show>
      <Show when={props.zone === 'after'}>
        <Separator edge="bottom" />
      </Show>
      <Show when={props.zone === 'inside'}>
        <div
          style={{
            position: 'absolute',
            inset: '0',
            'border-radius': '4px',
            'box-shadow': `inset 0 0 0 2px ${PRIMARY}`,
            // полупрозрачная заливка primary (эквивалент bg-primary/10).
            background: `color-mix(in oklch, ${PRIMARY} 12%, transparent)`,
            'pointer-events': 'none',
            'z-index': '10',
          }}
        />
      </Show>
    </>
  );
};

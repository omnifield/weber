/**
 * zone.ts — pure per-element reorder zone math (framework-agnostic).
 *
 * Generic reorder-фидбек: где относительно строки-цели окажется перетаскиваемый
 * элемент — соседом сверху (`before`), соседом снизу (`after`) или ребёнком
 * (`inside`). Раньше жил в `@omnifield/web-studio` (`tree/dndHelpers.ts`) — как
 * generic-функционал перенесён в пакет DnD; консюмер даёт лишь `canInside`-предикат.
 */

/** Позиция вставки относительно строки-цели. */
export type DropZone = 'before' | 'after' | 'inside';

/**
 * Пороги (доли высоты 0..1) для контейнера, принимающего `inside`:
 *  - `ratioY < before` → `before`;
 *  - `ratioY > after`  → `after`;
 *  - между ними         → `inside`.
 * Дефолт — `{ before: 0.3, after: 0.7 }`. Для `!canInside` (лист / контейнер,
 * не принимающий тип) пороги игнорируются — единственный сплит по 0.5.
 */
export interface IZoneThresholds {
  before?: number;
  after?: number;
}

const DEFAULT_BEFORE = 0.3;
const DEFAULT_AFTER = 0.7;

/**
 * Зона по вертикальной доле курсора внутри строки (`ratioY` 0..1):
 *  - `!canInside` — верх → `before`, низ → `after` (порог 0.5), вставка соседом;
 *  - `canInside`  — верхние `before` → `before`, нижние `after` → `after`,
 *    середина → `inside` (вложить ребёнком).
 *
 * Пороги для container-кейса опционально переопределяются `thresholds`
 * (дефолт 0.3 / 0.7). Leaf-кейс всегда делится по 0.5.
 */
export const zoneFromRatio = (
  ratioY: number,
  canInside: boolean,
  thresholds?: IZoneThresholds,
): DropZone => {
  if (!canInside) return ratioY < 0.5 ? 'before' : 'after';
  const before = thresholds?.before ?? DEFAULT_BEFORE;
  const after = thresholds?.after ?? DEFAULT_AFTER;
  if (ratioY < before) return 'before';
  if (ratioY > after) return 'after';
  return 'inside';
};

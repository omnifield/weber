/**
 * Манифест компонента — упрощённый порт unified-схемы предка (S2).
 * Живёт РЯДОМ с компонентом (`*.manifest.ts`), кит собирает в bundle;
 * студио/рендерер читают любой набор этого shape → юзерский компонент
 * приносит манифест и регистрируется наравне с нашими (расширяемость
 * by construction).
 *
 * НЕ портировано из предка (вернётся своими волнами, поля already-optional):
 * contract-слой (web-contract → embed/validation-волна), bundle-cost
 * автоген (weight/sizeKB — build-скрипт при студио), presets-поле.
 */

import type { JSX } from 'solid-js';

/** Закрытый список категорий палитры — расширять осознанно. */
export type ComponentCategory =
  | 'control'
  | 'typography'
  | 'container'
  | 'composition'
  | 'composite'
  | 'feedback'
  | 'wrapper';

export interface IComponentManifest {
  /** Dot-path в ките — ключ схемы рендерера. Напр. `'ui.Button'`, `'ui.Card.Header'`. */
  type: string;
  /** Человекочитаемое имя для палитры/инспектора. */
  label: string;
  category: ComponentCategory;
  description?: string;
  /** Иконка палитры (опционально — студио рисует fallback). */
  icon?: () => JSX.Element;
  /** Дефолтные props при вставке из палитры. */
  defaultProps?: Record<string, unknown>;
  /**
   * Zod-схема props для инспектора (кит держит zod peer'ом; схема —
   * данные манифеста, не runtime-валидация компонента).
   */
  propsSchema?: unknown;
  /** DnD-правила: лист (нет детей) / может быть корнем / кого принимает. */
  isLeaf?: boolean;
  canBeRoot?: boolean;
  accepts?: readonly string[];
  /** Имена style-слотов для точечных оверрайдов инспектора. */
  styleSlots?: readonly string[];
}

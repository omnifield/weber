/**
 * Pure-helpers UiProxy. Target-семантика (deriveName/getTargetData/AnyEvent) —
 * КОНТРАКТ kernel (общий язык ui-proxy и logic), здесь только re-export +
 * DOM-специфика (deriveInputType с картой из конвенций).
 */

export type { AnyEvent } from '@weber/kernel';
export { deriveName, getTargetData } from '@weber/kernel';

/**
 * Деривация HTML input-type из тегов по карте конвенций. `undefined` —
 * пусть DOM использует default либо явный `type="..."` автора Entity.
 */
export const deriveInputType = (
  meta: any,
  tagToInputType: Readonly<Record<string, string>>,
): string | undefined => {
  const tags: string[] = meta?.tags ?? [];
  for (const tag of tags) {
    const mapped = tagToInputType[tag];
    if (mapped) return mapped;
  }
  return undefined;
};

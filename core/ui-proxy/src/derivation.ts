/**
 * Pure-helpers UiProxy: не зависят от Solid/DOM — используются отдельно
 * (тесты, потребители за пределами proxy). Порт капсульного derivation.ts;
 * tag→input-type карта теперь приходит из конвенций (дефолт — в conventions.ts).
 */

export type AnyEvent = Event & {
  currentTarget?: unknown;
  key?: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
};

/** Деривация name: первый «конкретный» тег (без @-префикса) из meta.tags. */
export const deriveName = (meta: any): string | undefined =>
  meta?.tags?.find?.((t: string) => typeof t === 'string' && !t.startsWith('@'));

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

/**
 * Сборка `target`-объекта, который логический слой получает на каждое событие.
 * Pure-функция от (DOM event | undefined, merged props, derived name, rawValue).
 *
 * Приоритет `value`: checkbox.checked → el.value → rawValue (kobalte-style
 * onChange(value) без DOM Event) → props.value.
 */
export const getTargetData = (
  e: AnyEvent | undefined,
  finalProps: {
    name?: unknown;
    value?: unknown;
    meta?: unknown;
    dynamicMeta?: unknown;
    payload?: unknown;
  },
  derivedName?: string,
  rawValue?: unknown,
) => {
  const el = e?.currentTarget as any;
  const resolvedValue =
    el?.type === 'checkbox'
      ? el?.checked
      : el?.value !== undefined
        ? el.value
        : rawValue !== undefined
          ? rawValue
          : finalProps.value;
  return {
    name: el?.name || derivedName || finalProps.name,
    value: resolvedValue,
    type: el?.type,
    meta: finalProps?.meta,
    dynamicMeta: finalProps?.dynamicMeta,
    payload: finalProps?.payload,
    key: e?.key,
    modifiers: e
      ? {
          ctrl: !!e.ctrlKey,
          shift: !!e.shiftKey,
          alt: !!e.altKey,
          meta: !!e.metaKey,
        }
      : undefined,
  };
};

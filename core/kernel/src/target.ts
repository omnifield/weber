/**
 * Target — событийный КОНТРАКТ HCA: то, что логический слой получает на каждое
 * событие (DOM-dispatch из ui-proxy, программный emit из logic). Язык общий для
 * модулей → живёт в kernel вместе с двумя pure-хелперами его сборки.
 */

export interface ITargetModifiers {
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
  meta: boolean;
}

/** Meta-идентификация элемента: теги (роли) + access-поля. */
export interface ITagMeta {
  tags?: readonly string[];
  /** Capability для access-gating (ui-proxy, meta.can). */
  can?: string;
  /** Поведение при denied: 'disable' — рендер disabled; иначе render-null. */
  denied?: 'disable' | 'hide';
  [k: string]: unknown;
}

export interface ITarget {
  name?: unknown;
  value?: unknown;
  type?: string;
  meta?: ITagMeta;
  dynamicMeta?: ITagMeta;
  payload?: unknown;
  key?: string;
  modifiers?: ITargetModifiers;
  /** Данные явной передачи при bubble (`next.with(arg)`) — контракт логик-уровня. */
  from?: unknown;
}

export type AnyEvent = Event & {
  currentTarget?: unknown;
  key?: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
};

/** Деривация name: первый «конкретный» тег (без @-префикса) из meta.tags. */
export const deriveName = (meta: ITagMeta | undefined): string | undefined =>
  meta?.tags?.find?.((t) => typeof t === 'string' && !t.startsWith('@'));

/**
 * Сборка target из (DOM event | undefined, merged props, derived name, rawValue).
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
): ITarget => {
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
    meta: finalProps?.meta as ITagMeta | undefined,
    dynamicMeta: finalProps?.dynamicMeta as ITagMeta | undefined,
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

/**
 * Конвенции UiProxy — декларированный ВХОД модуля (ADR-0001).
 *
 * Всё, что в капсульном предке было размазано module-scope константами
 * (KIND_TAGS, EVENT_HANDLERS, RAW_PASSTHROUGH_KEYS, marker-префикс), здесь —
 * конфиг инстанса: `createUiProxy(overrides)` мержит поверх дефолтов.
 * Дефолты = проверенный капсульный набор; любой кит может привезти свои.
 */

/** Имя перехватываемого события + пишет ли оно value в store после вызова. */
export interface IEventConvention {
  /** `updateStore: true` → после события store.updateComponent({[id]:{value,type}}). */
  readonly updateStore: boolean;
}

export interface IUiProxyConventions {
  /**
   * Закрытый набор перехватываемых событий (капсула: ADR 009).
   * Ключ — JSX-имя обработчика (`onClick`, `onInput`, …).
   */
  readonly events: Readonly<Record<string, IEventConvention>>;
  /**
   * Whitelist «имя примитива кита → kind-tag», авто-инжект в `meta.tags`
   * перед регистрацией/binding'ом. Расширять осознанно: entry = приложения
   * могут опустить явный тег.
   */
  readonly kindTags: Readonly<Record<string, string>>;
  /**
   * Closed-set маппинг tag → HTML input-type (часть контракта tag-driven форм).
   */
  readonly tagToInputType: Readonly<Record<string, string>>;
  /**
   * Ключи кита, отдаваемые из Proxy КАК ЕСТЬ (control-flow, иконки, порталы):
   * обёртка сломала бы их render-prop/SVG-семантику и дала бы пустой оверхед.
   */
  readonly rawPassthroughKeys: ReadonlySet<string>;
  /**
   * Префикс/суффикс dedup-маркера bubbling (внутренний контракт инстанса;
   * не публичный API — константа, чтобы не плодить template strings в hot path).
   */
  readonly eventMarkerPrefix: string;
  readonly eventMarkerSuffix: string;
}

export const DEFAULT_CONVENTIONS: IUiProxyConventions = {
  events: {
    onClick: { updateStore: false },
    onDblClick: { updateStore: false },
    onInput: { updateStore: true },
    onChange: { updateStore: true },
    onBlur: { updateStore: false },
    onFocus: { updateStore: false },
    onKeyDown: { updateStore: false },
  },
  kindTags: {
    Input: 'input',
    Textarea: 'input',
    Select: 'input',
    Checkbox: 'input',
    Button: 'button',
  },
  tagToInputType: {
    password: 'password',
    email: 'email',
    phone: 'tel',
    number: 'number',
    text: 'text',
  },
  rawPassthroughKeys: new Set(['Flow', 'Icons']),
  eventMarkerPrefix: '__weber_',
  eventMarkerSuffix: '__',
};

/** Merge overrides поверх дефолтов (плоско по ключам конвенций). */
export const resolveConventions = (
  overrides?: Partial<IUiProxyConventions>,
): IUiProxyConventions => ({
  ...DEFAULT_CONVENTIONS,
  ...overrides,
});

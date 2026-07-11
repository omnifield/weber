/**
 * Порты кора — внешние швы, через которые модули говорят с пакетами
 * (ADR-0001: порт кора = мост пакета, одна механика).
 *
 * Store/FSM-порт: поверхность в объёме фактического потребления модулями
 * (ui-proxy: реестр компонентов; logic: мутации + FSM). Реализация — пакеты-
 * адаптеры (`@weber/state` solid-native = дефолт; xstate — опция). Протокол
 * ЗАКРЫТ и мал: user-domain живёт в `update()`-данных и хендлерах, удобства
 * (pick/values/patch) — в logic-модуле ПОВЕРХ порта, не здесь. Так «вагон
 * документов» бриджа-предка не растёт по построению.
 *
 * Контракты zero-cost: чистые интерфейсы; реализация обязана сохранять
 * реактивность Solid (геттеры читаются внутри реактивных скоупов модулей).
 */

/** Запись о смонтированном UI-элементе в реестре компонентов. */
export interface IRegisteredComponent {
  meta?: { tags?: readonly string[]; [k: string]: unknown };
  dynamicMeta?: { tags?: readonly string[]; [k: string]: unknown };
  payload?: Record<string, unknown>;
  name?: string;
  value?: unknown;
  type?: string;
  [k: string]: unknown;
}

/**
 * Поверхность стора, видимая модулям кора.
 *
 * `TCtx` — типизированный user-контекст (`store.ctx`); закрывает класс
 * CC-10 (store.ctx = any) на уровне порта.
 */
export interface IStorePort<TCtx = unknown> {
  /** Реактивный user-контекст (данные логики). */
  readonly ctx: TCtx;
  /** Сигнал загрузки логического слоя (поведение — за логикой, не за проксей). */
  readonly loading: boolean;
  /** Ошибки по именам. */
  readonly errors: Record<string, string>;
  /** Классы-патчи по derived-имени компонента. */
  readonly styles: Record<string, string | undefined>;
  /** Реестр смонтированных meta-компонентов по id. */
  readonly components: Record<string, IRegisteredComponent>;
  /** Prop-патчи от логики по id компонента. */
  readonly props: Record<string, Record<string, unknown> | undefined>;

  /**
   * Merge user-данных в ctx. ЕДИНСТВЕННЫЙ user-data канал порта — доменные
   * поля живут в данных, протокол под них не расширяется.
   * Контракт payload: сериализуемые данные (адаптер вправе клонировать —
   * защита от aliasing реактивных прокси).
   */
  update(payload: Record<string, unknown>): void;
  setLoading(value: boolean): void;
  setStyles(styles: Record<string, string>): void;
  setErrors(errors: Record<string, string>): void;
  /** Per-id merge prop-патчей: `{ [id]: { propName: value } }`. */
  setProps(payload: Record<string, Record<string, unknown>>): void;

  /** Регистрация meta-компонента: `{ [id]: snapshot }` (mount, единоразово). */
  registerComponent(patch: Record<string, unknown>): void;
  /** Снятие регистрации по id; чистит и props[id]. */
  unregisterComponent(id: string): void;
  /**
   * Runtime-патч зарегистрированной записи: `{ [id]: { value, type } }`.
   * Незарегистрированный id молча игнорируется (порядок mount/event не валит app).
   */
  updateComponent(patch: Record<string, Record<string, unknown>>): void;
}

/** FSM-поверхность инстанса логики: текущий стейт + переходы (goto-модель). */
export interface IStateApi {
  readonly current: string;
  /** Переход по имени стейта. Неизвестное имя — no-op (адаптер вправе warn). */
  set(name: string): void;
  matches(name: string | string[]): boolean;
}

/**
 * Минимальная engine-форма схемы логики: адаптеру нужны только `initial`,
 * имена `states` и `context`; САМИ хендлеры внутри стейтов — язык logic-модуля,
 * адаптер их не читает. Декларативные переходы/guards — сознательно НЕ в v1
 * (goto-модель = канон; расширение — отдельным ADR по реальной нужде).
 */
export interface ILogicSchema<TCtx = unknown> {
  initial: string;
  context?: TCtx;
  states: Record<string, Record<string, unknown>>;
  [k: string]: unknown;
}

/** Инстанс логики, отданный адаптером. Живёт в Solid owner-скоупе вызывателя. */
export interface ILogicInstance<TCtx = unknown> {
  readonly stateApi: IStateApi;
  readonly store: IStorePort<TCtx>;
  /** Сырой реактивный снапшот адаптера (opaque; в ICtx.state для совместимости). */
  readonly snapshot: unknown;
}

/**
 * State-адаптер — контракт пакета-начинки (`@weber/state` и альтернативы).
 * `create` ОБЯЗАН вызываться внутри Solid owner-скоупа (реактивность/cleanup).
 */
export interface IStateAdapter {
  readonly name: string;
  create<TCtx = unknown>(schema: ILogicSchema<TCtx>): ILogicInstance<TCtx>;
}

/**
 * Диспатч-поверхность контроллера: имена методов схемо-зависимы
 * (`controller.onClick(target, ctx)`), поэтому index-signature.
 */
export interface IControllerPort {
  readonly store?: IStorePort;
  [method: string]: unknown;
}

/**
 * Runtime-контекст HCA-дерева: то, что видят модули и обёртки через
 * `useCtx()`. `state` — реактивный СНАПШОТ логического слоя (не машина).
 */
export interface ICtx<TCtx = unknown, TState = unknown> {
  readonly state: TState;
  readonly store: IStorePort<TCtx>;
  readonly controller: IControllerPort;
  /** У root-узла родителя нет. */
  readonly parent?: ICtx;
}

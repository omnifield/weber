/**
 * Порты кора — внешние швы, через которые модули говорят с пакетами
 * (ADR-0001: порт кора = мост пакета, одна механика).
 *
 * Здесь — READ/WRITE-поверхность state-порта в объёме, который реально
 * потребляют модули (source: фактическое использование ui-proxy). Шаг 2
 * (logic-модуль) расширит порт FSM-стороной (создание машины, transitions);
 * первый адаптер к порту — пакет `@weber/state` (XState) в пакетной волне.
 *
 * Контракты zero-cost: чистые интерфейсы, никаких runtime-обёрток; реализация
 * обязана сохранять реактивность Solid (геттеры/сторы адаптера читаются
 * внутри реактивных скоупов модулей).
 */

/**
 * Поверхность стора, видимая модулям кора.
 *
 * `TCtx` — типизированный user-контекст (`store.ctx`); закрывает класс
 * CC-10 (store.ctx = any) на уровне порта: потребители уточняют TCtx
 * через `createUseCtx<TCtx>()`.
 */
export interface IStorePort<TCtx = unknown> {
  /** Реактивный user-контекст (в XState-адаптере — `state.context`). */
  readonly ctx: TCtx;
  /** Классы-патчи по derived-имени компонента (`store.styles[name]`). */
  readonly styles?: Record<string, string | undefined>;
  /** Prop-патчи от логики по id компонента (`store.props[id]`). */
  readonly props?: Record<string, Record<string, unknown> | undefined>;
  /** Сигнал загрузки логического слоя (поведение — за логикой, не за проксей). */
  readonly loading?: boolean;
  /** Регистрация meta-компонента: `{ [id]: snapshot }`. */
  registerComponent(patch: Record<string, unknown>): void;
  /** Снятие регистрации по id (Solid onCleanup). */
  unregisterComponent(id: string): void;
  /** Runtime-патч зарегистрированного компонента: `{ [id]: { value, type } }`. */
  updateComponent(patch: Record<string, Record<string, unknown>>): void;
}

/**
 * Диспатч-поверхность контроллера: имена методов схемо-зависимы
 * (`controller.onClick(target, ctx)`), поэтому index-signature. `store` —
 * удобный alias внутри handlers (зеркало капсульного IControllerHandle).
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

import type { ILogicSchema, IStateApi, ITarget } from '@omnifield/weber-kernel';
import type { IStoreFacade } from './store-facade';

/** Bubble к родителю: пассивный `next()` либо с явной передачей `next.with(arg)`. */
export interface INext {
  <T = any>(): Promise<T | null>;
  with<T = any>(arg: unknown): Promise<T | null>;
}

/** Программный HCA-dispatch (близнец DOM-пути ui-proxy). */
export type EmitFn = (eventName: string, partial?: Partial<ITarget>) => unknown;

/**
 * API, который получает каждый хендлер (event + lifecycle).
 * `context` = user-данные логики (`store.ctx`) — БЕЗ `.data`-обёртки предка:
 * порт отдаёт чистый user-контекст (CC-10 закрыт на шве).
 */
export interface IHandlerApi<TCtx = any> {
  target: ITarget;
  context: TCtx;
  store: IStoreFacade<TCtx>;
  state: IStateApi;
  next: INext;
  emit: EmitFn;
  /** Только в onError. */
  error?: unknown;
  /** Только в onError — имя упавшего метода. */
  method?: string;
}

export type Handler<TCtx = any> = (api: IHandlerApi<TCtx>) => any;

/**
 * Полная форма схемы логики (расширяет engine-минимум kernel'а):
 * per-state хендлеры + lifecycle. Декларативных переходов НЕТ намеренно —
 * goto-модель = канон v1 (`state.set(name)`); пересмотр — отдельным ADR.
 */
export interface ILogicSchemaFull<TCtx = any> extends ILogicSchema<TCtx> {
  states: Record<string, Record<string, Handler<TCtx> | undefined>>;
  /** Реактивно на каждую регистрацию компонента (лениво-монтируемые дети). */
  onRegister?: Handler<TCtx>;
  /** Единственный teardown-хук (Solid onCleanup; async не ждётся). */
  onDispose?: Handler<TCtx>;
  /** Централизованный error-hook: получает `error` + `method`. */
  onError?: Handler<TCtx>;
  [k: string]: any;
}

/**
 * Services, инжектируемые в фабрику схемы. Состав — за сборкой (config
 * logic-модуля), не за модулем: router/api/zod и пр. приходят снаружи.
 * `emit` доступен ЛЕНИВО (только изнутри хендлеров, не на верхнем уровне фабрики).
 */
export type IServices = Record<string, unknown> & { emit?: EmitFn };

export type LogicKind = 'controller' | 'feature';

/** Props логик-обёртки (Controller/Feature-компонента). */
export interface ILogicWrapperProps {
  children?: any;
  fallback?: any;
  /** Ремап имён событий при bubble к родителю: `{ localName: parentName }`. */
  overrides?: Record<string, string>;
}

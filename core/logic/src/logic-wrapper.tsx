import type { ICompositeWrap, ICtx, IStateAdapter } from '@omnifield/weber-kernel';
import { CompositeWrapContext, Context, useCompositeWrap, useCtx } from '@omnifield/weber-kernel';
import { createEffect, createUniqueId, onCleanup, Suspense } from 'solid-js';
import { ControllerProxy } from './controller-proxy';
import { createEmit } from './emit';
import type {
  EmitFn,
  IHandlerApi,
  ILogicSchemaFull,
  ILogicWrapperProps,
  INext,
  IServices,
  LogicKind,
} from './interfaces';
import { createTagRegistry } from './query';
import { createStoreFacade } from './store-facade';

/**
 * Конфиг logic-модуля — декларированный ВХОД (ADR-0001). Всё, что у предка
 * было жёсткой сцепкой монолита, здесь — инъекция:
 *  - adapter: state-начинка (порт kernel; дефолт экосистемы — @omnifield/weber-state);
 *  - services: состав services для фабрик схем — за сборкой (router/api/…),
 *    модуль о них не знает;
 *  - compositeWrap: связка с ui-proxy (bindEvents) — задаётся при сборке,
 *    прямой dep между модулями не нужен;
 *  - trace: observability-слот (у предка — жёсткий импорт web-profiler);
 *  - aliases: tag-алиасы поверх дефолтов (пер-инстансный реестр, не глобал).
 */
export interface ILogicModuleConfig {
  adapter: IStateAdapter;
  services?: (kind: LogicKind) => Record<string, unknown>;
  compositeWrap?: (ctx: ICtx<any, any>) => ICompositeWrap['wrap'];
  trace?: (node: string, phase: 'mount' | 'dispose', data?: Record<string, unknown>) => void;
  aliases?: Record<string, readonly string[]>;
}

export type SchemaFactory<TCtx = any> = (services: IServices) => ILogicSchemaFull<TCtx>;

/** API инстанса logic-модуля. */
export interface ILogicApi {
  /** Фабрика Controller-обёртки (UI-события, без IO по канону compliance). */
  createController: (factory: SchemaFactory) => (props: ILogicWrapperProps) => any;
  /** Фабрика Feature-обёртки (domain logic / side effects). */
  createFeature: (factory: SchemaFactory) => (props: ILogicWrapperProps) => any;
  /** Дописать tag-алиасы инстанса (поверх дефолтов + config.aliases). */
  registerAliases: (next: Record<string, readonly string[]>) => void;
}

export const createLogic = (config: ILogicModuleConfig): ILogicApi => {
  const registry = createTagRegistry(config.aliases);

  const createWrapper = (kind: LogicKind) => (factory: SchemaFactory) =>
    function LogicWrapper(props: ILogicWrapperProps) {
      // Trace-слот: per-mount id парит mount↔dispose; no-op без config.trace.
      const traceId = createUniqueId();
      config.trace?.(`weber.logic.${kind}`, 'mount', { id: traceId });
      onCleanup(() => config.trace?.(`weber.logic.${kind}`, 'dispose', { id: traceId }));

      const parent = useCtx();

      // services.emit — ЛЕНИВЫЙ alias (валиден только изнутри хендлеров;
      // фабрика зовётся синхронно ДО создания controller'а).
      const services: IServices = { ...(config.services?.(kind) ?? {}) };
      services.emit = (eventName, partial) => ctxEmit!(eventName, partial);

      const schema = factory(services);

      // Инстанс state-начинки: живёт в Solid owner-скоупе этого компонента.
      const instance = config.adapter.create(schema);
      const store = createStoreFacade(instance.store, registry.expand);
      const stateApi = instance.stateApi;

      // ctx строится в два шага (controller читает ctx лениво через замыкания;
      // к первому вызову хендлера controller уже присвоен).
      const ctx: ICtx<any, any> & { controller: any } = {
        controller: null as any,
        state: instance.snapshot,
        store,
        parent,
      };

      let ctxEmit: EmitFn | undefined;
      const proxyEmit: EmitFn = (eventName, partial) => ctxEmit!(eventName, partial);

      const controller = ControllerProxy({
        schema,
        stateApi,
        store,
        parent,
        overrides: props.overrides,
        emit: proxyEmit,
      });
      ctx.controller = controller;
      ctxEmit = createEmit(ctx);

      // Lifecycle-хуки не имеют родительского UI-события — next() = no-op.
      const lifecycleNext = Object.assign(async () => null, {
        with: async () => null,
      }) as unknown as INext;

      const lifecycleApi = (): IHandlerApi => ({
        target: {},
        context: store.ctx,
        store,
        state: stateApi,
        next: lifecycleNext,
        emit: proxyEmit,
      });

      // onInit / onExit (+ initial-onInit на mount) — реактивно по current.
      let prevState: string | undefined;
      createEffect(() => {
        const current = stateApi.current;
        if (prevState === undefined) {
          schema.states[current]?.onInit?.(lifecycleApi());
        } else if (prevState !== current) {
          schema.states[prevState]?.onExit?.(lifecycleApi());
          schema.states[current]?.onInit?.(lifecycleApi());
        }
        prevState = current;
      });

      // onRegister — реактивно на каждую регистрацию компонента (lazy-дети,
      // Suspense). От пользователя требуется идемпотентность.
      createEffect(() => {
        void store.components;
        schema.onRegister?.(lifecycleApi());
      });

      onCleanup(() => {
        // onDispose — единственный teardown-хук; async не ждём (onCleanup
        // синхронный), ошибки логируем — throw не должен валить unmount.
        try {
          const r = schema.onDispose?.(lifecycleApi());
          if (r && typeof (r as Promise<unknown>).catch === 'function') {
            (r as Promise<unknown>).catch((err) =>
              console.error('[logic] onDispose async failed:', err),
            );
          }
        } catch (err) {
          console.error('[logic] onDispose sync threw:', err);
        }
      });

      // props.children обязаны читаться ЛЕНИВО (внутри JSX под Provider'ом),
      // иначе дети инстанцируются до установки ctx и useCtx() их не увидит.
      // Без своего wrap наследуем внешний (не шадоуим undefined'ом).
      const wrap = config.compositeWrap?.(ctx);
      const outerComposite = useCompositeWrap();
      const compositeValue = wrap ? { wrap } : outerComposite;

      return (
        <Suspense fallback={props.fallback}>
          <Context.Provider value={ctx}>
            <CompositeWrapContext.Provider value={compositeValue as ICompositeWrap}>
              {props.children}
            </CompositeWrapContext.Provider>
          </Context.Provider>
        </Suspense>
      );
    };

  return {
    createController: createWrapper('controller'),
    createFeature: createWrapper('feature'),
    registerAliases: registry.register,
  };
};

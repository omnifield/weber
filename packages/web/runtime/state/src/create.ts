import { type AnyStateMachine, assign, createMachine } from 'xstate';

/**
 * Минимальный shape per-state handlers'а, который видит engine. Concrete-handlers
 * (`onClick`/`onInput`/...) живут в `@omnifield/web-core` и расширяют этот
 * интерфейс через `extends IBaseStateHandlers` — shared-base паттерн.
 */
export interface IBaseStateHandlers {
  onInit?: (api: any) => any;
  onExit?: (api: any) => any;
  [methodName: string]: ((api: any) => any) | undefined;
}

/**
 * Базовая HCA-схема для XState-машины. Engine читает отсюда `initial` и `states`
 * (для построения `__GOTO_*`-переходов). Lifecycle-хуки (`onMount`/`onClick`/...)
 * и handler-API (`IHandlerApi`) — это уровень web-core; они расширяют этот тип
 * через `extends IBaseStateSchema` в `wrappers/interfaces.ts`.
 *
 * **Контракт unification (Phase F):**
 *  - `web-state` — single source of truth для engine-shape.
 *  - `web-core` — расширяет (`IDefineStateSchema extends IBaseStateSchema`),
 *    добавляя UX-handlers и `onMount` lifecycle.
 *  - НЕТ цикла: web-core зависит от web-state, не наоборот.
 */
export interface IBaseStateSchema<TCtx = any> {
  initial: string;
  context?: TCtx;
  states: Record<string, IBaseStateHandlers>;
  [methodName: string]: any;
}

export interface IMachineContext<TCtx = any> {
  data: TCtx;
  loading: boolean;
  errors: Record<string, string>;
  styles: Record<string, string>;
  components: Record<string, any>;
  /**
   * Динамические patch'и props у компонентов, индексированные по id.
   * Контроллер пишет сюда через `store.setProps({...})`; UiProxy при рендере
   * мержит эти значения поверх статичных props у компонента с тем же id.
   * Канал общего назначения — для `active`, кастомных флагов, и пр.
   */
  props: Record<string, Record<string, any>>;
}

/**
 * Строит XState-машину из пользовательской HCA-схемы.
 * Машина владеет: списком стейтов, переходами (через __GOTO_*) и универсальными store-мутациями.
 * UI-события (onClick, onInput, ...) и onInit/onExit обрабатываются НЕ через XState event-bus —
 * см. ControllerProxy + createLogicWrapper.
 */
export const createState = <TCtx = any>(schema: IBaseStateSchema<TCtx>): AnyStateMachine => {
  const stateNames = Object.keys(schema.states);

  const gotoTransitions: Record<string, any> = {};
  for (const name of stateNames) {
    gotoTransitions[`__GOTO_${name}__`] = { target: `.${name}` };
  }

  return createMachine({
    id: 'omnifield-fsm',
    initial: schema.initial,
    context: {
      data: (schema.context ?? {}) as any,
      loading: false,
      errors: {},
      styles: {},
      components: {},
      props: {},
    },
    states: Object.fromEntries(stateNames.map((s) => [s, {}])) as any,
    on: {
      ...gotoTransitions,
      SET_DATA: {
        actions: assign({
          data: ({ context, event }: any) => ({ ...context.data, ...event.payload }),
        }),
      },
      SET_LOADING: {
        actions: assign({ loading: ({ event }: any) => event.value }),
      },
      SET_STYLES: {
        actions: assign({ styles: ({ event }: any) => event.styles }),
      },
      SET_ERRORS: {
        actions: assign({ errors: ({ event }: any) => event.errors }),
      },
      REGISTER_COMPONENT: {
        actions: assign({
          components: ({ context, event }: any) => ({
            ...context.components,
            ...event.payload,
          }),
        }),
      },
      UNREGISTER_COMPONENT: {
        actions: assign({
          components: ({ context, event }: any) => {
            const { [event.id]: _, ...rest } = context.components;
            return rest;
          },
          props: ({ context, event }: any) => {
            const { [event.id]: _, ...rest } = context.props;
            return rest;
          },
        }),
      },
      // Runtime-патч к уже зарегистрированной записи компонента.
      // Семантика: REGISTER_COMPONENT — единоразово на mount;
      // UPDATE_COMPONENT — runtime-патч после register'а (value/type/etc).
      // Неизвестный id молча игнорируется — порядок mount/event не должен валить app.
      // payload — `{ [id]: { fieldName: value, ... } }`.
      UPDATE_COMPONENT: {
        actions: assign({
          components: ({ context, event }: any) => {
            const next = { ...context.components };
            for (const [id, patch] of Object.entries(event.payload as Record<string, any>)) {
              // skip unknown id — UPDATE предполагает прежнюю регистрацию через REGISTER_COMPONENT.
              // Молча игнорим, чтобы порядок mount/event не ломал app.
              if (next[id]) next[id] = { ...next[id], ...patch };
            }
            return next;
          },
        }),
      },
      // Per-id patch'и props: мержим поверх существующего, без полной замены.
      // payload — `{ [id]: { propName: value, ... } }`.
      SET_PROPS: {
        actions: assign({
          props: ({ context, event }: any) => {
            const next = { ...context.props };
            for (const [id, patch] of Object.entries(event.payload as Record<string, any>)) {
              next[id] = { ...(next[id] ?? {}), ...patch };
            }
            return next;
          },
        }),
      },
    },
  });
};

/**
 * Solid-native state-адаптер — дефолтная начинка FSM/store-порта kernel'а
 * (решение user 2026-07-12: честный контракт кора = реактивный store + goto;
 * XState — опциональный адаптер для настоящих FSM-фич, отдельным пакетом).
 *
 * Реализация: Solid store (context) + signal (current state). Реактивность
 * портовых чтений — геттерами поверх store/signal; модули читают их в своих
 * реактивных скоупах.
 */

import type { ILogicInstance, ILogicSchema, IStateAdapter, IStorePort } from '@weber/kernel';
import { createSignal } from 'solid-js';
import { createStore, produce, unwrap } from 'solid-js/store';

interface IAdapterContext {
  data: Record<string, unknown>;
  loading: boolean;
  errors: Record<string, string>;
  styles: Record<string, string>;
  components: Record<string, any>;
  props: Record<string, Record<string, unknown>>;
}

/**
 * Санитизация update-payload (порт инварианта bridge-предка, ADR 008):
 * Solid-store-прокси, записанный в другой ключ, алиасит внутренние узлы —
 * последующий update физически перезаписал бы соседа. `unwrap` снимает
 * прокси, `structuredClone` рвёт идентичность. Контракт `update()` —
 * сериализуемые данные (data-mutation API, не передача поведения).
 */
const sanitisePayload = (payload: Record<string, unknown>): Record<string, unknown> =>
  structuredClone(unwrap(payload));

export const createSolidStateAdapter = (): IStateAdapter => ({
  name: 'weber:state-solid',

  create<TCtx = unknown>(schema: ILogicSchema<TCtx>): ILogicInstance<TCtx> {
    const stateNames = Object.keys(schema.states);
    const [current, setCurrent] = createSignal(schema.initial);

    const [state, setState] = createStore<IAdapterContext>({
      data: { ...((schema.context as Record<string, unknown> | undefined) ?? {}) },
      loading: false,
      errors: {},
      styles: {},
      components: {},
      props: {},
    });

    const store: IStorePort<TCtx> = {
      get ctx() {
        // Порт отдаёт ЧИСТЫЙ user-контекст (без машинной обёртки предка).
        return state.data as TCtx;
      },
      get loading() {
        return state.loading;
      },
      get errors() {
        return state.errors;
      },
      get styles() {
        return state.styles;
      },
      get components() {
        return state.components;
      },
      get props() {
        return state.props;
      },

      update: (payload) => {
        // setStore с объектом на пути — shallow-merge ключей (капсульная
        // семантика SET_DATA: `{ ...data, ...payload }`).
        setState('data', sanitisePayload(payload));
      },
      setLoading: (value) => setState('loading', value),
      // Семантика предка: SET_STYLES / SET_ERRORS ЗАМЕНЯЮТ карту целиком.
      setStyles: (styles) =>
        setState(
          produce((s) => {
            s.styles = { ...styles };
          }),
        ),
      setErrors: (errors) =>
        setState(
          produce((s) => {
            s.errors = { ...errors };
          }),
        ),
      setProps: (payload) =>
        setState(
          produce((s) => {
            // Per-id MERGE поверх существующего (не полная замена).
            for (const [id, patch] of Object.entries(payload)) {
              s.props[id] = { ...(s.props[id] ?? {}), ...patch };
            }
          }),
        ),

      registerComponent: (patch) =>
        setState(
          produce((s) => {
            // Per-id REPLACE (mount-снапшот целиком). Реестр меняет REF верхнего
            // уровня — контракт порта: coarse-подписка на `store.components`
            // фаерит на каждую регистрацию (onRegister, lazy-дети).
            s.components = { ...s.components, ...patch };
          }),
        ),
      unregisterComponent: (id) =>
        setState(
          produce((s) => {
            const { [id]: _, ...rest } = s.components;
            s.components = rest;
            delete s.props[id];
          }),
        ),
      updateComponent: (payload) =>
        setState(
          produce((s) => {
            for (const [id, patch] of Object.entries(payload)) {
              // Незарегистрированный id молча игнорируется (порядок
              // mount/event не должен валить app) — контракт порта.
              if (s.components[id]) Object.assign(s.components[id], patch);
            }
          }),
        ),
    };

    const stateApi = {
      get current() {
        return current();
      },
      set: (name: string) => {
        if (!stateNames.includes(name)) {
          console.warn(`[weber:state-solid] unknown state "${name}" — переход проигнорирован`);
          return;
        }
        setCurrent(name);
      },
      matches: (n: string | string[]) =>
        Array.isArray(n) ? n.includes(current()) : current() === n,
    };

    // Снапшот в форме предка ({ value, context }) — для совместимости
    // потребителей ICtx.state; opaque для kernel.
    const snapshot = {
      get value() {
        return current();
      },
      get context() {
        return state;
      },
    };

    return { stateApi, store, snapshot };
  },
});

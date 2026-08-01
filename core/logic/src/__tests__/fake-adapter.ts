/**
 * Фейк-адаптер для тестов logic-модуля: минимальная реализация FSM/store-порта
 * на Solid-примитивах. Модуль тестируется ПРОТИВ ПОРТА (не против пакета
 * @omnifield/weber-state — у кора нет прав на deps в пакеты, даже тестовых).
 */

import type { ILogicInstance, ILogicSchema, IStateAdapter } from '@omnifield/weber-kernel';
import { createSignal } from 'solid-js';
import { createStore, produce } from 'solid-js/store';

export const createFakeAdapter = (): IStateAdapter => ({
  name: 'weber:state-fake',
  create<TCtx = unknown>(schema: ILogicSchema<TCtx>): ILogicInstance<TCtx> {
    const names = Object.keys(schema.states);
    const [current, setCurrent] = createSignal(schema.initial);
    const [state, setState] = createStore({
      data: { ...((schema.context as Record<string, unknown> | undefined) ?? {}) },
      loading: false,
      errors: {} as Record<string, string>,
      styles: {} as Record<string, string>,
      components: {} as Record<string, any>,
      props: {} as Record<string, Record<string, unknown>>,
    });

    return {
      stateApi: {
        get current() {
          return current();
        },
        set: (name: string) => {
          if (names.includes(name)) setCurrent(name);
        },
        matches: (n: string | string[]) =>
          Array.isArray(n) ? n.includes(current()) : current() === n,
      },
      store: {
        get ctx() {
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
        update: (p) => setState('data', { ...p }),
        setLoading: (v) => setState('loading', v),
        setStyles: (s) =>
          setState(
            produce((st) => {
              st.styles = { ...s };
            }),
          ),
        setErrors: (e) =>
          setState(
            produce((st) => {
              st.errors = { ...e };
            }),
          ),
        setProps: (payload) =>
          setState(
            produce((st) => {
              for (const [id, patch] of Object.entries(payload)) {
                st.props[id] = { ...(st.props[id] ?? {}), ...patch };
              }
            }),
          ),
        registerComponent: (patch) =>
          setState(
            produce((st) => {
              // Смена ref верхнего уровня — coarse-подписка (onRegister) фаерит.
              st.components = { ...st.components, ...patch };
            }),
          ),
        unregisterComponent: (id) =>
          setState(
            produce((st) => {
              const { [id]: _, ...rest } = st.components;
              st.components = rest;
              delete st.props[id];
            }),
          ),
        updateComponent: (payload) =>
          setState(
            produce((st) => {
              for (const [id, patch] of Object.entries(payload)) {
                if (st.components[id]) Object.assign(st.components[id], patch);
              }
            }),
          ),
      },
      snapshot: {
        get value() {
          return current();
        },
      },
    };
  },
});

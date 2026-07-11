/**
 * Conformance-suite FSM/store-порта (ADR-0001 §конкурс): любой state-адаптер
 * экосистемы обязан проходить этот набор. Первый потребитель — solid-native
 * адаптер этого пакета; следующий — XState-адаптер (и это же — тест того, как
 * ЮЗЕР строит свою начинку через публичные контракты).
 *
 * Запуск: `runStateAdapterConformance('label', () => makeAdapter())` внутри
 * vitest-файла адаптера.
 */

import type { IStateAdapter } from '@weber/kernel';
import { createComputed, createRoot } from 'solid-js';
import { describe, expect, it } from 'vitest';

const SCHEMA = {
  initial: 'idle',
  context: { count: 0, items: [{ id: 1 }, { id: 2 }] },
  states: { idle: {}, loading: {}, done: {} },
};

/** Хелпер: инстанс в Solid-руте с авто-dispose после сценария. */
const withInstance = (
  adapter: IStateAdapter,
  run: (instance: ReturnType<IStateAdapter['create']>) => void,
) => {
  createRoot((dispose) => {
    const instance = adapter.create(structuredClone(SCHEMA));
    try {
      run(instance);
    } finally {
      dispose();
    }
  });
};

export const runStateAdapterConformance = (
  label: string,
  makeAdapter: () => IStateAdapter,
): void => {
  describe(`state-port conformance — ${label}`, () => {
    it('initial: current = schema.initial; ctx = schema.context', () => {
      withInstance(makeAdapter(), ({ stateApi, store }) => {
        expect(stateApi.current).toBe('idle');
        expect((store.ctx as any).count).toBe(0);
      });
    });

    it('goto: set(name) переключает current; matches работает со строкой и массивом', () => {
      withInstance(makeAdapter(), ({ stateApi }) => {
        stateApi.set('loading');
        expect(stateApi.current).toBe('loading');
        expect(stateApi.matches('loading')).toBe(true);
        expect(stateApi.matches(['idle', 'loading'])).toBe(true);
        expect(stateApi.matches('done')).toBe(false);
      });
    });

    it('goto: неизвестный стейт — no-op (не throw, current не меняется)', () => {
      withInstance(makeAdapter(), ({ stateApi }) => {
        stateApi.set('nope');
        expect(stateApi.current).toBe('idle');
      });
    });

    it('current реактивен: createEffect видит переход', () => {
      withInstance(makeAdapter(), ({ stateApi }) => {
        const seen: string[] = [];
        createComputed(() => {
          seen.push(stateApi.current);
        });
        stateApi.set('loading');
        expect(seen).toEqual(['idle', 'loading']);
      });
    });

    it('update: shallow-merge в ctx; чтение реактивно', () => {
      withInstance(makeAdapter(), ({ store }) => {
        const seen: unknown[] = [];
        createComputed(() => {
          seen.push((store.ctx as any).count);
        });
        store.update({ count: 5 });
        expect((store.ctx as any).count).toBe(5);
        // соседние ключи не тронуты
        expect((store.ctx as any).items).toHaveLength(2);
        expect(seen).toEqual([0, 5]);
      });
    });

    it('update: инвариант aliasing — записанный store-прокси НЕ делит identity с источником', () => {
      withInstance(makeAdapter(), ({ store }) => {
        const item = (store.ctx as any).items[0];
        store.update({ selected: item });
        const ctx = store.ctx as any;
        expect(ctx.selected).toEqual({ id: 1 });
        expect(ctx.selected).not.toBe(ctx.items[0]);
        // перезапись selected не задевает items
        store.update({ selected: { id: 99 } });
        expect((store.ctx as any).items[0]).toEqual({ id: 1 });
      });
    });

    it('registerComponent / unregisterComponent: replace per-id; unregister чистит и props[id]', () => {
      withInstance(makeAdapter(), ({ store }) => {
        store.registerComponent({ a: { name: 'login', meta: { tags: ['login'] } } });
        store.registerComponent({ b: { name: 'pass' } });
        expect(Object.keys(store.components)).toEqual(['a', 'b']);
        store.setProps({ a: { disabled: true } });
        store.unregisterComponent('a');
        expect(store.components.a).toBeUndefined();
        expect(store.props.a).toBeUndefined();
        expect(store.components.b).toBeDefined();
      });
    });

    it('updateComponent: merge полей в запись; незарегистрированный id молча игнорируется', () => {
      withInstance(makeAdapter(), ({ store }) => {
        store.registerComponent({ a: { name: 'login', meta: { tags: ['login'] } } });
        store.updateComponent({ a: { value: 'x' }, ghost: { value: 'y' } });
        expect(store.components.a.value).toBe('x');
        expect(store.components.a.name).toBe('login');
        expect(store.components.ghost).toBeUndefined();
      });
    });

    it('components реактивен: createEffect видит каждую регистрацию', () => {
      withInstance(makeAdapter(), ({ store }) => {
        let runs = 0;
        createComputed(() => {
          void store.components;
          runs++;
        });
        store.registerComponent({ a: { name: 'x' } });
        store.registerComponent({ b: { name: 'y' } });
        expect(runs).toBe(3); // initial + 2 регистрации
      });
    });

    it('setProps: per-id merge (существующие поля id не затираются)', () => {
      withInstance(makeAdapter(), ({ store }) => {
        store.setProps({ a: { active: true } });
        store.setProps({ a: { disabled: true } });
        expect(store.props.a).toEqual({ active: true, disabled: true });
      });
    });

    it('setLoading / setStyles / setErrors: loading — значение; styles/errors — замена карты целиком', () => {
      withInstance(makeAdapter(), ({ store }) => {
        store.setLoading(true);
        expect(store.loading).toBe(true);
        store.setStyles({ login: 'red' });
        store.setStyles({ pass: 'blue' });
        expect(store.styles).toEqual({ pass: 'blue' });
        store.setErrors({ login: 'bad' });
        store.setErrors({});
        expect(store.errors).toEqual({});
      });
    });
  });
};

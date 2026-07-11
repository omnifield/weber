import { describe, expect, it, vi } from 'vitest';
import { ControllerProxy } from '../controller-proxy';

const mkStateApi = (initial = 'idle') => {
  let current = initial;
  return {
    get current() {
      return current;
    },
    set: (n: string) => {
      current = n;
    },
    matches: (n: string | string[]) => (Array.isArray(n) ? n.includes(current) : current === n),
  };
};

const mkStore = () => ({ ctx: { user: 'u1' } }) as any;

describe('ControllerProxy — dispatch resolution', () => {
  it('резолвит хендлер текущего стейта', async () => {
    const handler = vi.fn().mockResolvedValue('ok');
    const controller = ControllerProxy({
      schema: { initial: 'idle', states: { idle: { onClick: handler }, busy: {} } } as any,
      stateApi: mkStateApi(),
      store: mkStore(),
    });
    const result = await controller.onClick({ name: 'go' }, { user: 'u1' });
    expect(result).toBe('ok');
    const api = handler.mock.calls[0][0];
    expect(api.target.name).toBe('go');
    expect(api.context).toEqual({ user: 'u1' }); // чистый user-ctx, БЕЗ .data-обёртки
  });

  it('per-state приоритет: в другом стейте — другой хендлер', async () => {
    const idleH = vi.fn();
    const busyH = vi.fn();
    const stateApi = mkStateApi();
    const controller = ControllerProxy({
      schema: {
        initial: 'idle',
        states: { idle: { onClick: idleH }, busy: { onClick: busyH } },
      } as any,
      stateApi,
      store: mkStore(),
    });
    await controller.onClick({}, {});
    stateApi.set('busy');
    await controller.onClick({}, {});
    expect(idleH).toHaveBeenCalledOnce();
    expect(busyH).toHaveBeenCalledOnce();
  });

  it('fallback на top-level метод схемы', async () => {
    const top = vi.fn().mockReturnValue(7);
    const controller = ControllerProxy({
      schema: { initial: 'idle', states: { idle: {} }, onRefresh: top } as any,
      stateApi: mkStateApi(),
      store: mkStore(),
    });
    expect(await controller.onRefresh({}, {})).toBe(7);
  });

  it('метод не найден → автобабблинг к родителю; без родителя → null', async () => {
    const parentHandler = vi.fn().mockResolvedValue('from-parent');
    const parent = { controller: { onMissing: parentHandler } } as any;
    const controller = ControllerProxy({
      schema: { initial: 'idle', states: { idle: {} } } as any,
      stateApi: mkStateApi(),
      store: mkStore(),
      parent,
    });
    expect(await controller.onMissing({ name: 'x' }, { c: 1 })).toBe('from-parent');
    // target при пассивном bubble несёт from=undefined
    expect(parentHandler.mock.calls[0][0].from).toBeUndefined();

    const orphan = ControllerProxy({
      schema: { initial: 'idle', states: { idle: {} } } as any,
      stateApi: mkStateApi(),
      store: mkStore(),
    });
    expect(await orphan.onMissing({}, {})).toBeNull();
  });

  it('next() и next.with(arg) из хендлера: пассивный bubble vs явная передача from', async () => {
    const parentHandler = vi.fn().mockResolvedValue('parent-result');
    const parent = { controller: { onSave: parentHandler } } as any;
    const controller = ControllerProxy({
      schema: {
        initial: 'idle',
        states: {
          idle: {
            onSave: async ({ next }: any) => {
              const passive = await next();
              const explicit = await next.with({ id: 5 });
              return { passive, explicit };
            },
          },
        },
      } as any,
      stateApi: mkStateApi(),
      store: mkStore(),
      parent,
    });
    const r = await controller.onSave({ name: 's' }, {});
    expect(r).toEqual({ passive: 'parent-result', explicit: 'parent-result' });
    expect(parentHandler.mock.calls[0][0].from).toBeUndefined();
    expect(parentHandler.mock.calls[1][0].from).toEqual({ id: 5 });
  });

  it('overrides ремапит имя при bubble', async () => {
    const parentTarget = vi.fn().mockResolvedValue('mapped');
    const parent = { controller: { onParentName: parentTarget } } as any;
    const controller = ControllerProxy({
      schema: { initial: 'idle', states: { idle: {} } } as any,
      stateApi: mkStateApi(),
      store: mkStore(),
      parent,
      overrides: { onLocalName: 'onParentName' },
    });
    expect(await controller.onLocalName({}, {})).toBe('mapped');
  });

  it('state api в хендлере: set/matches/current (goto-модель)', async () => {
    const stateApi = mkStateApi();
    const controller = ControllerProxy({
      schema: {
        initial: 'idle',
        states: {
          idle: {
            onGo: ({ state }: any) => {
              expect(state.current).toBe('idle');
              state.set('busy');
              return state.matches(['busy', 'done']);
            },
          },
          busy: {},
        },
      } as any,
      stateApi,
      store: mkStore(),
    });
    expect(await controller.onGo({}, {})).toBe(true);
    expect(stateApi.current).toBe('busy');
  });

  it('ошибка хендлера: re-throw + onError hook получает error и method', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const onError = vi.fn();
    const controller = ControllerProxy({
      schema: {
        initial: 'idle',
        states: {
          idle: {
            onBoom: () => {
              throw new Error('boom');
            },
          },
        },
        onError,
      } as any,
      stateApi: mkStateApi(),
      store: mkStore(),
    });
    await expect(controller.onBoom({}, {})).rejects.toThrow('boom');
    const api = onError.mock.calls[0][0];
    expect((api.error as Error).message).toBe('boom');
    expect(api.method).toBe('onBoom');
    errSpy.mockRestore();
  });

  it('controller.store — системное поле, возвращает фасад', () => {
    const store = mkStore();
    const controller = ControllerProxy({
      schema: { initial: 'idle', states: { idle: {} } } as any,
      stateApi: mkStateApi(),
      store,
    });
    expect(controller.store).toBe(store);
  });
});

/* @vitest-environment jsdom */
import { useCompositeWrap, useCtx } from '@weber/kernel';
import { render } from 'solid-js/web';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IHandlerApi } from '../interfaces';
import { createLogic } from '../logic-wrapper';
import { createFakeAdapter } from './fake-adapter';

let container: HTMLDivElement;
let cleanup: () => void;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
});

afterEach(() => {
  cleanup?.();
  document.body.removeChild(container);
  vi.restoreAllMocks();
});

const mkLogic = (
  extra: Parameters<typeof createLogic>[0] extends infer C ? Partial<C> : never = {} as any,
) => createLogic({ adapter: createFakeAdapter(), ...(extra as object) });

describe('logic-wrapper — lifecycle', () => {
  it('onInit initial-стейта фаерит на mount; goto фаерит onExit/onInit', () => {
    const calls: string[] = [];
    let api!: IHandlerApi;
    const logic = mkLogic();
    const Feature = logic.createFeature(() => ({
      initial: 'idle',
      states: {
        idle: {
          onInit: (a) => {
            api = a;
            calls.push('idle:init');
          },
          onExit: () => calls.push('idle:exit'),
        },
        busy: {
          onInit: () => calls.push('busy:init'),
        },
      },
    }));
    cleanup = render(() => <Feature />, container);
    expect(calls).toEqual(['idle:init']);
    api.state.set('busy');
    expect(calls).toEqual(['idle:init', 'idle:exit', 'busy:init']);
  });

  it('onRegister фаерит реактивно на каждую регистрацию компонента', () => {
    const onRegister = vi.fn();
    let api!: IHandlerApi;
    const logic = mkLogic();
    const Feature = logic.createFeature(() => ({
      initial: 'idle',
      states: { idle: { onInit: (a) => (api = a) } },
      onRegister,
    }));
    cleanup = render(() => <Feature />, container);
    const initialRuns = onRegister.mock.calls.length; // initial effect run
    api.store.registerComponent({ a: { name: 'x' } });
    api.store.registerComponent({ b: { name: 'y' } });
    expect(onRegister.mock.calls.length).toBe(initialRuns + 2);
  });

  it('onDispose зовётся на unmount', () => {
    const onDispose = vi.fn();
    const logic = mkLogic();
    const Feature = logic.createFeature(() => ({
      initial: 'idle',
      states: { idle: {} },
      onDispose,
    }));
    const dispose = render(() => <Feature />, container);
    expect(onDispose).not.toHaveBeenCalled();
    dispose();
    expect(onDispose).toHaveBeenCalledOnce();
    cleanup = () => {};
  });

  it('trace-слот получает mount/dispose с парным id', () => {
    const trace = vi.fn();
    const logic = createLogic({ adapter: createFakeAdapter(), trace });
    const Ctrl = logic.createController(() => ({ initial: 'idle', states: { idle: {} } }));
    const dispose = render(() => <Ctrl />, container);
    dispose();
    cleanup = () => {};
    expect(trace.mock.calls[0][0]).toBe('weber.logic.controller');
    expect(trace.mock.calls[0][1]).toBe('mount');
    expect(trace.mock.calls[1][1]).toBe('dispose');
    expect(trace.mock.calls[0][2].id).toBe(trace.mock.calls[1][2].id);
  });
});

describe('logic-wrapper — ctx-дерево и dispatch', () => {
  it('children видят ctx через useCtx; controller диспатчит; parent-цепочка строится', async () => {
    const parentHandler = vi.fn().mockResolvedValue('root-got-it');
    const logic = mkLogic();
    const Root = logic.createFeature(() => ({
      initial: 'idle',
      states: { idle: { onBubbled: parentHandler } },
    }));
    const Child = logic.createController(() => ({
      initial: 'idle',
      states: { idle: {} },
    }));

    let childCtx: any;
    const Probe = () => {
      childCtx = useCtx();
      return null;
    };
    cleanup = render(
      () => (
        <Root>
          <Child>
            <Probe />
          </Child>
        </Root>
      ),
      container,
    );
    expect(childCtx).toBeDefined();
    expect(childCtx.parent).toBeDefined();
    // dispatch отсутствующего метода у ребёнка → автобабблинг в root
    const result = await childCtx.controller.onBubbled({ name: 'evt' }, childCtx.store.ctx);
    expect(result).toBe('root-got-it');
    expect(parentHandler).toHaveBeenCalledOnce();
  });

  it('services из конфига доходят до фабрики; services.emit ленивый и диспатчит', async () => {
    let seenServices: any;
    let api!: IHandlerApi;
    const onPing = vi.fn().mockReturnValue('pong');
    const logic = createLogic({
      adapter: createFakeAdapter(),
      services: (kind) => ({ kind, router: { goTo: vi.fn() } }),
    });
    const Feature = logic.createFeature((services) => {
      seenServices = services;
      return {
        initial: 'idle',
        states: { idle: { onInit: (a) => (api = a), onPing } },
      };
    });
    cleanup = render(() => <Feature />, container);
    expect(seenServices.kind).toBe('feature');
    expect(seenServices.router).toBeDefined();
    // ленивый services.emit работает после mount'а
    const r = await seenServices.emit('onPing', { payload: { n: 1 } });
    expect(r).toBe('pong');
    expect(onPing.mock.calls[0][0].target.payload).toEqual({ n: 1 });
    // emit из handler-api тоже живой
    await api.emit('onPing');
    expect(onPing).toHaveBeenCalledTimes(2);
  });

  it('store-фасад в хендлере: update/ctx + pick/values/patch поверх порта', () => {
    let api!: IHandlerApi;
    const logic = mkLogic();
    const Feature = logic.createFeature(() => ({
      initial: 'idle',
      context: { user: 'u1' },
      states: { idle: { onInit: (a) => (api = a) } },
    }));
    cleanup = render(() => <Feature />, container);

    expect((api.store.ctx as any).user).toBe('u1');
    api.store.update({ user: 'u2' });
    expect((api.store.ctx as any).user).toBe('u2');

    api.store.registerComponent({
      id1: { name: 'email', value: 'a@b', meta: { tags: ['email'] } },
      id2: { name: 'submit', meta: { tags: ['submit'] } },
    });
    // алиас @inputs раскрывается (дефолтный реестр)
    expect(Object.keys(api.store.pick(['@inputs']))).toEqual(['id1']);
    expect(api.store.values(['@inputs'])).toEqual({ email: 'a@b' });
    // tag-based patch → props
    api.store.patch(['submit'], { disabled: true });
    expect(api.store.props.id2).toEqual({ disabled: true });
  });

  it('registerAliases инстанса расширяет запросы', () => {
    let api!: IHandlerApi;
    const logic = mkLogic();
    logic.registerAliases({ '@mine': ['alpha', 'beta'] });
    const Feature = logic.createFeature(() => ({
      initial: 'idle',
      states: { idle: { onInit: (a) => (api = a) } },
    }));
    cleanup = render(() => <Feature />, container);
    api.store.registerComponent({ x: { name: 'n', meta: { tags: ['beta'] } } });
    expect(Object.keys(api.store.pick(['@mine']))).toEqual(['x']);
  });

  it('compositeWrap провайдится в CompositeWrapContext при наличии в конфиге', () => {
    const wrap = vi.fn((c: any) => c);
    const logic = createLogic({
      adapter: createFakeAdapter(),
      compositeWrap: () => wrap,
    });
    const Feature = logic.createFeature(() => ({ initial: 'idle', states: { idle: {} } }));
    let seen: any;
    const Probe = () => {
      seen = useCompositeWrap();
      return null;
    };
    cleanup = render(
      () => (
        <Feature>
          <Probe />
        </Feature>
      ),
      container,
    );
    expect(seen?.wrap).toBe(wrap);
  });
});

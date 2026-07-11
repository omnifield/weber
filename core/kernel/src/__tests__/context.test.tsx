/* @vitest-environment jsdom */
import { render } from 'solid-js/web';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Context, createUseCtx, useCtx } from '../context';
import type { ICtx } from '../ports';

const mkCtx = (): ICtx<{ foo: string }> => ({
  state: { value: 'idle' },
  store: {
    ctx: { foo: 'bar' },
    loading: false,
    errors: {},
    styles: {},
    components: {},
    props: {},
    update: () => {},
    setLoading: () => {},
    setStyles: () => {},
    setErrors: () => {},
    setProps: () => {},
    registerComponent: () => {},
    unregisterComponent: () => {},
    updateComponent: () => {},
  },
  controller: {},
});

let container: HTMLDivElement;
let cleanup: () => void;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
});

afterEach(() => {
  cleanup?.();
  document.body.removeChild(container);
});

describe('kernel Context', () => {
  it('useCtx resolves the nearest enclosing Provider', () => {
    const ctx = mkCtx();
    let seen: unknown;
    const Probe = () => {
      seen = useCtx<{ foo: string }>();
      return null;
    };
    cleanup = render(
      () => (
        <Context.Provider value={ctx}>
          <Probe />
        </Context.Provider>
      ),
      container,
    );
    expect(seen).toBe(ctx);
  });

  it('useCtx outside a Provider is undefined (модули обязаны иметь fallback)', () => {
    let seen: unknown = 'sentinel';
    const Probe = () => {
      seen = useCtx();
      return null;
    };
    cleanup = render(() => <Probe />, container);
    expect(seen).toBeUndefined();
  });

  it('createUseCtx shares the SAME Context identity as useCtx', () => {
    const ctx = mkCtx();
    const useTyped = createUseCtx<{ foo: string }>();
    let seen: ICtx<{ foo: string }> | undefined;
    const Probe = () => {
      seen = useTyped();
      return null;
    };
    cleanup = render(
      () => (
        <Context.Provider value={ctx}>
          <Probe />
        </Context.Provider>
      ),
      container,
    );
    expect(seen).toBe(ctx);
    expect(seen?.store.ctx.foo).toBe('bar');
  });
});

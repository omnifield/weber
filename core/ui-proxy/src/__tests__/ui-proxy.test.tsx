/* @vitest-environment jsdom */
import { Context } from '@omnifield/weber-kernel';
import { For, Show } from 'solid-js';
import { render } from 'solid-js/web';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createUiProxy } from '../ui-proxy';

// Conformance-suite модуля ui-proxy (семя — капсульный ui-proxy.test.tsx,
// fix-then-transfer). Тестим API дефолт-инстанса: тот же wrap, что уходит
// через Proxy.get; любой кандидат-модуль обязан проходить этот набор.

const { wrapComponent, proxy: UiProxy, eventMarker } = createUiProxy();

const mkCtx = (overrides: Partial<any> = {}) => {
  const controller: Record<string, ReturnType<typeof vi.fn>> = {
    onClick: vi.fn(),
    onDblClick: vi.fn(),
    onInput: vi.fn(),
    onChange: vi.fn(),
    onBlur: vi.fn(),
    onFocus: vi.fn(),
    onKeyDown: vi.fn(),
  };
  const store = {
    registerComponent: vi.fn(),
    unregisterComponent: vi.fn(),
    update: vi.fn(),
    updateComponent: vi.fn(),
    ctx: { foo: 'bar' },
    styles: {} as Record<string, string>,
    loading: false,
    props: {} as Record<string, any>,
  };
  return { controller, store, parent: null, state: { value: 'idle' } as any, ...overrides };
};

const StubButton = (props: any) => (
  <button data-testid="btn" type={props.type ?? 'button'} {...props}>
    {props.children}
  </button>
);
const StubInput = (props: any) => <input data-testid="inp" {...props} />;

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

describe('wrapComponent — pass-through (no own meta)', () => {
  it('does NOT register in store', () => {
    const ctx = mkCtx() as any;
    const Wrapped = wrapComponent(ctx, {}, StubButton);
    cleanup = render(() => <Wrapped>Hi</Wrapped>, container);
    expect(ctx.store.registerComponent).not.toHaveBeenCalled();
  });

  it('renders children through', () => {
    const ctx = mkCtx() as any;
    const Wrapped = wrapComponent(ctx, {}, StubButton);
    cleanup = render(() => <Wrapped>Hi</Wrapped>, container);
    expect(container.textContent).toBe('Hi');
  });

  it('click does NOT invoke ctx.controller.onClick', () => {
    const ctx = mkCtx() as any;
    const Wrapped = wrapComponent(ctx, {}, StubButton);
    cleanup = render(() => <Wrapped>Hi</Wrapped>, container);
    const btn = container.querySelector('[data-testid="btn"]') as HTMLButtonElement;
    btn.click();
    expect(ctx.controller.onClick).not.toHaveBeenCalled();
  });
});

describe('wrapComponent — own meta path', () => {
  it('registers in store on mount', () => {
    const ctx = mkCtx() as any;
    const Wrapped = wrapComponent(ctx, {}, StubButton);
    cleanup = render(() => <Wrapped meta={{ tags: ['submit'] }}>Go</Wrapped>, container);
    expect(ctx.store.registerComponent).toHaveBeenCalledOnce();
    const arg = ctx.store.registerComponent.mock.calls[0][0];
    const [, registered] = Object.entries(arg)[0] as [string, any];
    expect(registered.name).toBe('submit');
  });

  it('unregisters on cleanup (Solid dispose)', () => {
    const ctx = mkCtx() as any;
    const Wrapped = wrapComponent(ctx, {}, StubButton);
    const dispose = render(() => <Wrapped meta={{ tags: ['submit'] }}>Go</Wrapped>, container);
    expect(ctx.store.registerComponent).toHaveBeenCalledOnce();
    dispose();
    expect(ctx.store.unregisterComponent).toHaveBeenCalledOnce();
    cleanup = () => {};
  });

  it('click invokes ctx.controller.onClick with target + ctx.store.ctx', () => {
    const ctx = mkCtx() as any;
    const Wrapped = wrapComponent(ctx, {}, StubButton);
    cleanup = render(() => <Wrapped meta={{ tags: ['submit'] }}>Go</Wrapped>, container);
    const btn = container.querySelector('[data-testid="btn"]') as HTMLButtonElement;
    btn.click();
    expect(ctx.controller.onClick).toHaveBeenCalledOnce();
    const [target, context] = ctx.controller.onClick.mock.calls[0];
    expect(target.name).toBe('submit');
    expect(context).toEqual({ foo: 'bar' });
  });

  it('also invokes props.onClick after ctx.controller.onClick', () => {
    const ctx = mkCtx() as any;
    const userHandler = vi.fn();
    const Wrapped = wrapComponent(ctx, {}, StubButton);
    cleanup = render(
      () => (
        <Wrapped meta={{ tags: ['submit'] }} onClick={userHandler}>
          Go
        </Wrapped>
      ),
      container,
    );
    const btn = container.querySelector('[data-testid="btn"]') as HTMLButtonElement;
    btn.click();
    expect(userHandler).toHaveBeenCalledOnce();
  });

  it('input event: updateStore=true → store.updateComponent called with value+type only', () => {
    const ctx = mkCtx() as any;
    const Wrapped = wrapComponent(ctx, {}, StubInput);
    cleanup = render(() => <Wrapped meta={{ tags: ['email'] }} />, container);
    const inp = container.querySelector('[data-testid="inp"]') as HTMLInputElement;
    inp.value = 'foo@bar';
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    expect(ctx.store.updateComponent).toHaveBeenCalledOnce();
    const arg = ctx.store.updateComponent.mock.calls[0][0];
    const [, payload] = Object.entries(arg)[0] as [string, any];
    expect(Object.keys(payload)).toEqual(['value', 'type']);
    expect(ctx.controller.onInput).toHaveBeenCalledOnce();
  });

  it('input event: store.update (user namespace) NOT called', () => {
    const ctx = mkCtx() as any;
    const Wrapped = wrapComponent(ctx, {}, StubInput);
    cleanup = render(() => <Wrapped meta={{ tags: ['email'] }} />, container);
    const inp = container.querySelector('[data-testid="inp"]') as HTMLInputElement;
    inp.value = 'foo@bar';
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    expect(ctx.store.update).not.toHaveBeenCalled();
  });

  it('click event: updateStore=false → store.updateComponent NOT called', () => {
    const ctx = mkCtx() as any;
    const Wrapped = wrapComponent(ctx, {}, StubButton);
    cleanup = render(() => <Wrapped meta={{ tags: ['submit'] }}>Go</Wrapped>, container);
    const btn = container.querySelector('[data-testid="btn"]') as HTMLButtonElement;
    btn.click();
    expect(ctx.controller.onClick).toHaveBeenCalledOnce();
    expect(ctx.store.updateComponent).not.toHaveBeenCalled();
    expect(ctx.store.update).not.toHaveBeenCalled();
  });
});

describe('wrapComponent — event bubble dedupe', () => {
  it('outer wrapper does not invoke ctx.controller twice for the same event', () => {
    const ctx = mkCtx() as any;
    const Inner = (p: any) => (
      <span data-testid="inner" {...p}>
        {p.children}
      </span>
    );
    const Outer = (p: any) => (
      <div data-testid="outer" {...p}>
        {p.children}
      </div>
    );
    const WrappedInner = wrapComponent(ctx, {}, Inner);
    const WrappedOuter = wrapComponent(ctx, {}, Outer);

    cleanup = render(
      () => (
        <WrappedOuter meta={{ tags: ['outer'] }}>
          <WrappedInner meta={{ tags: ['inner'] }}>x</WrappedInner>
        </WrappedOuter>
      ),
      container,
    );

    const inner = container.querySelector('[data-testid="inner"]') as HTMLElement;
    inner.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(ctx.controller.onClick).toHaveBeenCalledOnce();
  });
});

describe('wrapComponent — Proxy subcomponent (Field.Label-like)', () => {
  it('sub-component access returns wrapped component', () => {
    const ctx = mkCtx() as any;
    // biome-ignore lint/a11y/noLabelWithoutControl: test stub for sub-component access
    const Label = (p: any) => <label {...p}>{p.children}</label>;
    const Field = Object.assign((p: any) => <fieldset {...p}>{p.children}</fieldset>, { Label });
    const WrappedField = wrapComponent(ctx, {}, Field);
    const WrappedLabel = (WrappedField as any).Label;

    expect(typeof WrappedLabel).toBe('function');
    cleanup = render(
      () => <WrappedLabel meta={{ tags: ['email-label'] }}>Email</WrappedLabel>,
      container,
    );
    expect(ctx.store.registerComponent).toHaveBeenCalledOnce();
  });
});

describe('wrapComponent — kindTags auto-inject (conventions)', () => {
  it('whitelist primitive (Input) without explicit tag — meta.tags gets "input"', () => {
    const ctx = mkCtx() as any;
    const Wrapped = wrapComponent(ctx, {}, StubInput, 'Input');
    cleanup = render(() => <Wrapped meta={{ tags: ['login'] }} />, container);
    expect(ctx.store.registerComponent).toHaveBeenCalledOnce();
    const arg = ctx.store.registerComponent.mock.calls[0][0];
    const [, registered] = Object.entries(arg)[0] as [string, any];
    expect(registered.meta.tags).toContain('input');
    expect(registered.meta.tags).toContain('login');
  });

  it('already-explicit "input" tag — does NOT duplicate', () => {
    const ctx = mkCtx() as any;
    const Wrapped = wrapComponent(ctx, {}, StubInput, 'Input');
    cleanup = render(() => <Wrapped meta={{ tags: ['login', 'input'] }} />, container);
    const arg = ctx.store.registerComponent.mock.calls[0][0];
    const [, registered] = Object.entries(arg)[0] as [string, any];
    const inputOccurrences = registered.meta.tags.filter((t: string) => t === 'input').length;
    expect(inputOccurrences).toBe(1);
  });

  it('non-whitelist primitive (Card) — no auto-tag added', () => {
    const StubCard = (props: any) => (
      <div data-testid="card" {...props}>
        {props.children}
      </div>
    );
    const ctx = mkCtx() as any;
    const Wrapped = wrapComponent(ctx, {}, StubCard, 'Card');
    cleanup = render(() => <Wrapped meta={{ tags: ['profile'] }} />, container);
    const arg = ctx.store.registerComponent.mock.calls[0][0];
    const [, registered] = Object.entries(arg)[0] as [string, any];
    expect(registered.meta.tags).toEqual(['profile']);
  });

  it('deriveName picks user-tag first (login before injected input)', () => {
    const ctx = mkCtx() as any;
    const Wrapped = wrapComponent(ctx, {}, StubInput, 'Input');
    cleanup = render(() => <Wrapped meta={{ tags: ['login'] }} />, container);
    const arg = ctx.store.registerComponent.mock.calls[0][0];
    const [, registered] = Object.entries(arg)[0] as [string, any];
    expect(registered.name).toBe('login');
  });

  it('controller.onClick receives effectiveMeta with kind-tag injected', () => {
    const ctx = mkCtx() as any;
    const Wrapped = wrapComponent(ctx, {}, StubButton, 'Button');
    cleanup = render(() => <Wrapped meta={{ tags: ['submit'] }}>Go</Wrapped>, container);
    const btn = container.querySelector('[data-testid="btn"]') as HTMLButtonElement;
    btn.click();
    const [target] = ctx.controller.onClick.mock.calls[0];
    expect(target.meta.tags).toContain('button');
  });

  it('sub-component access (Card.Header) — NO kind-tag injected', () => {
    const Header = (p: any) => (
      <header data-testid="hdr" {...p}>
        {p.children}
      </header>
    );
    const StubCard = Object.assign((p: any) => <div {...p}>{p.children}</div>, { Header });
    const ctx = mkCtx() as any;
    const WrappedCard = wrapComponent(ctx, {}, StubCard, 'Card');
    const WrappedHeader = (WrappedCard as any).Header;

    cleanup = render(
      () => <WrappedHeader meta={{ tags: ['profile-header'] }}>Title</WrappedHeader>,
      container,
    );
    const arg = ctx.store.registerComponent.mock.calls[0][0];
    const [, registered] = Object.entries(arg)[0] as [string, any];
    expect(registered.meta.tags).toEqual(['profile-header']);
  });
});

describe('wrapComponent — safeCall error handling', () => {
  it('sync throw in user handler does NOT propagate', () => {
    const ctx = mkCtx() as any;
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const Wrapped = wrapComponent(ctx, {}, StubButton);
    cleanup = render(
      () => (
        <Wrapped
          meta={{ tags: ['submit'] }}
          onClick={() => {
            throw new Error('boom');
          }}
        >
          Go
        </Wrapped>
      ),
      container,
    );
    const btn = container.querySelector('[data-testid="btn"]') as HTMLButtonElement;
    expect(() => btn.click()).not.toThrow();
    expect(errSpy).toHaveBeenCalled();
  });
});

describe('proxy — kit-agnostic binding contract', () => {
  it('button obtained via proxy.get with meta dispatches onClick to controller', () => {
    const ctx = mkCtx() as any;
    const stubKit = { Button: StubButton };
    const proxied = UiProxy(stubKit, ctx, {});
    const WrappedButton = (proxied as any).Button;

    cleanup = render(
      () => <WrappedButton meta={{ tags: ['save'] }}>Save</WrappedButton>,
      container,
    );

    const btn = container.querySelector('[data-testid="btn"]') as HTMLButtonElement;
    btn.click();
    expect(ctx.controller.onClick).toHaveBeenCalledOnce();
    const [target] = ctx.controller.onClick.mock.calls[0];
    expect(target.name).toBe('save');
  });

  it('button obtained via proxy.get WITHOUT meta does NOT dispatch', () => {
    const ctx = mkCtx() as any;
    const stubKit = { Button: StubButton };
    const proxied = UiProxy(stubKit, ctx, {});
    const WrappedButton = (proxied as any).Button;

    cleanup = render(() => <WrappedButton>NoMeta</WrappedButton>, container);

    const btn = container.querySelector('[data-testid="btn"]') as HTMLButtonElement;
    btn.click();
    expect(ctx.controller.onClick).not.toHaveBeenCalled();
  });
});

describe('proxy — rawPassthroughKeys returned raw (not wrapped)', () => {
  it('Flow key is returned verbatim — exact same reference', () => {
    const ctx = mkCtx() as any;
    const flowNs = { For, Show };
    const proxied = UiProxy({ Flow: flowNs }, ctx, {});
    expect((proxied as any).Flow).toBe(flowNs);
    expect((proxied as any).Flow.For).toBe(For);
  });

  it('Flow.For renders items reactively (correct Solid For semantics)', () => {
    const ctx = mkCtx() as any;
    const proxied = UiProxy({ Flow: { For } }, ctx, {});
    const FlowFor = (proxied as any).Flow.For;

    cleanup = render(
      () => (
        <ul>
          <FlowFor each={['a', 'b', 'c']}>
            {(item: string) => <li data-testid="item">{item}</li>}
          </FlowFor>
        </ul>
      ),
      container,
    );

    const items = container.querySelectorAll('[data-testid="item"]');
    expect(items).toHaveLength(3);
    expect(ctx.store.registerComponent).not.toHaveBeenCalled();
  });

  it('Icons namespace is returned verbatim', () => {
    const ctx = mkCtx() as any;
    const StubIcon = (props: any) => (
      <svg data-testid="icon" {...props}>
        <title>Icon</title>
      </svg>
    );
    const iconsNs = { Grip: StubIcon };
    const proxied = UiProxy({ Icons: iconsNs }, ctx, {});
    expect((proxied as any).Icons).toBe(iconsNs);
    expect((proxied as any).Icons.Grip).toBe(StubIcon);
  });
});

describe('wrapComponent — kobalte-style raw-value onChange', () => {
  const StubSelect = (props: any) => {
    return (
      <button
        type="button"
        data-testid="select"
        onClick={() => {
          props.onChange?.('developer');
        }}
      />
    );
  };

  it('raw string value → updateComponent called with that value', () => {
    const ctx = mkCtx() as any;
    const Wrapped = wrapComponent(ctx, {}, StubSelect, 'Select');
    cleanup = render(() => <Wrapped meta={{ tags: ['role'] }} />, container);
    const el = container.querySelector('[data-testid="select"]') as HTMLElement;
    el.click();
    expect(ctx.store.updateComponent).toHaveBeenCalledOnce();
    const arg = ctx.store.updateComponent.mock.calls[0][0];
    const [, payload] = Object.entries(arg)[0] as [string, any];
    expect(payload.value).toBe('developer');
  });

  it('raw string value → controller.onChange with correct target, no modifiers', () => {
    const ctx = mkCtx() as any;
    const Wrapped = wrapComponent(ctx, {}, StubSelect, 'Select');
    cleanup = render(() => <Wrapped meta={{ tags: ['role'] }} />, container);
    const el = container.querySelector('[data-testid="select"]') as HTMLElement;
    el.click();
    expect(ctx.controller.onChange).toHaveBeenCalledOnce();
    const [target] = ctx.controller.onChange.mock.calls[0];
    expect(target.value).toBe('developer');
    expect(target.name).toBe('role');
    expect(target.modifiers).toBeUndefined();
  });

  it('user onChange handler receives the original raw value', () => {
    const ctx = mkCtx() as any;
    const userHandler = vi.fn();
    const Wrapped = wrapComponent(ctx, {}, StubSelect, 'Select');
    cleanup = render(() => <Wrapped meta={{ tags: ['role'] }} onChange={userHandler} />, container);
    const el = container.querySelector('[data-testid="select"]') as HTMLElement;
    el.click();
    expect(userHandler).toHaveBeenCalledWith('developer');
  });

  it('Select auto-injects "input" kind-tag; initial value captured at registration', () => {
    const ctx = mkCtx() as any;
    const Wrapped = wrapComponent(ctx, {}, StubSelect, 'Select');
    cleanup = render(() => <Wrapped meta={{ tags: ['role'] }} value="developer" />, container);
    const arg = ctx.store.registerComponent.mock.calls[0][0];
    const [, registered] = Object.entries(arg)[0] as [string, any];
    expect(registered.meta.tags).toContain('input');
    expect(registered.value).toBe('developer');
  });

  it('native input onChange with DOM Event still works (no regression)', () => {
    const ctx = mkCtx() as any;
    const Wrapped = wrapComponent(ctx, {}, StubInput);
    cleanup = render(() => <Wrapped meta={{ tags: ['email'] }} />, container);
    const inp = container.querySelector('[data-testid="inp"]') as HTMLInputElement;
    inp.value = 'test@example.com';
    inp.dispatchEvent(new Event('change', { bubbles: true }));
    const arg = ctx.store.updateComponent.mock.calls[0][0];
    const [, payload] = Object.entries(arg)[0] as [string, any];
    expect(payload.value).toBe('test@example.com');
  });
});

describe('wrapComponent — dynamic ctx via enclosing kernel Context.Provider', () => {
  it('meta-button wrapped with OUTER ctx but rendered inside INNER Provider dispatches to INNER', () => {
    const outer = mkCtx() as any;
    const inner = mkCtx() as any;
    const Wrapped = wrapComponent(outer, {}, StubButton);

    cleanup = render(
      () => (
        <Context.Provider value={inner}>
          <Wrapped meta={{ tags: ['ping'] }}>Ping</Wrapped>
        </Context.Provider>
      ),
      container,
    );

    expect(inner.store.registerComponent).toHaveBeenCalledOnce();
    expect(outer.store.registerComponent).not.toHaveBeenCalled();

    const btn = container.querySelector('[data-testid="btn"]') as HTMLButtonElement;
    btn.click();

    expect(inner.controller.onClick).toHaveBeenCalledOnce();
    expect(outer.controller.onClick).not.toHaveBeenCalled();
  });

  it('falls back to captured ctx when no enclosing Provider', () => {
    const ctx = mkCtx() as any;
    const Wrapped = wrapComponent(ctx, {}, StubButton);
    cleanup = render(() => <Wrapped meta={{ tags: ['submit'] }}>Go</Wrapped>, container);
    const btn = container.querySelector('[data-testid="btn"]') as HTMLButtonElement;
    btn.click();
    expect(ctx.controller.onClick).toHaveBeenCalledOnce();
    expect(ctx.store.registerComponent).toHaveBeenCalledOnce();
  });
});

describe('wrapComponent — disabled: no auto-inject from store.loading', () => {
  it('disabled NOT set when store.loading=true and props.disabled absent', () => {
    const ctx = mkCtx({ store: { ...mkCtx().store, loading: true } }) as any;
    const Wrapped = wrapComponent(ctx, {}, StubButton);
    cleanup = render(() => <Wrapped meta={{ tags: ['submit'] }}>Go</Wrapped>, container);
    const btn = container.querySelector('[data-testid="btn"]') as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it('disabled IS set when props.disabled=true (explicit JSX source)', () => {
    const ctx = mkCtx() as any;
    const Wrapped = wrapComponent(ctx, {}, StubButton);
    cleanup = render(
      () => (
        <Wrapped meta={{ tags: ['submit'] }} disabled={true}>
          Go
        </Wrapped>
      ),
      container,
    );
    const btn = container.querySelector('[data-testid="btn"]') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('store.loading does NOT bleed into store.props auto-patch', () => {
    const ctx = mkCtx({ store: { ...mkCtx().store, loading: true } }) as any;
    const Wrapped = wrapComponent(ctx, {}, StubButton);
    cleanup = render(() => <Wrapped meta={{ tags: ['submit'] }}>Go</Wrapped>, container);
    expect(Object.keys(ctx.store.props)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// НОВОЕ (weber, ADR-0001): контракт параметризации конвенциями — то, ради чего
// модуль стал модулем. Инстансы независимы, конвенции подменяемы.
// ---------------------------------------------------------------------------

describe('createUiProxy — conventions parameterization (module contract)', () => {
  it('custom kindTags: чужой кит привозит свой whitelist', () => {
    const custom = createUiProxy({ kindTags: { FancyField: 'input' } });
    const ctx = mkCtx() as any;
    const Wrapped = custom.wrapComponent(ctx, {}, StubInput, 'FancyField');
    cleanup = render(() => <Wrapped meta={{ tags: ['login'] }} />, container);
    const arg = ctx.store.registerComponent.mock.calls[0][0];
    const [, registered] = Object.entries(arg)[0] as [string, any];
    expect(registered.meta.tags).toContain('input');
  });

  it('custom kindTags: дефолтный whitelist при override НЕ действует', () => {
    const custom = createUiProxy({ kindTags: { FancyField: 'input' } });
    const ctx = mkCtx() as any;
    // 'Input' есть в ДЕФОЛТНЫХ конвенциях, но не в custom — авто-тега нет.
    const Wrapped = custom.wrapComponent(ctx, {}, StubInput, 'Input');
    cleanup = render(() => <Wrapped meta={{ tags: ['login'] }} />, container);
    const arg = ctx.store.registerComponent.mock.calls[0][0];
    const [, registered] = Object.entries(arg)[0] as [string, any];
    expect(registered.meta.tags).toEqual(['login']);
  });

  it('custom rawPassthroughKeys: свой ключ отдаётся как есть', () => {
    const custom = createUiProxy({ rawPassthroughKeys: new Set(['Charts']) });
    const ctx = mkCtx() as any;
    const chartsNs = { Line: StubButton };
    const proxied = custom.proxy({ Charts: chartsNs }, ctx, {});
    expect((proxied as any).Charts).toBe(chartsNs);
  });

  it('custom events: суженный набор — незаявленное событие не биндится', () => {
    const custom = createUiProxy({ events: { onClick: { updateStore: false } } });
    const ctx = mkCtx() as any;
    const Wrapped = custom.wrapComponent(ctx, {}, StubInput);
    cleanup = render(() => <Wrapped meta={{ tags: ['email'] }} />, container);
    const inp = container.querySelector('[data-testid="inp"]') as HTMLInputElement;
    inp.value = 'x';
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    // onInput не в конвенциях этого инстанса → контроллер его не получает.
    expect(ctx.controller.onInput).not.toHaveBeenCalled();
    inp.click();
    expect(ctx.controller.onClick).toHaveBeenCalledOnce();
  });

  it('eventMarker uses instance prefix (default = __weber_)', () => {
    expect(eventMarker('onClick')).toBe('__weber_onClick__');
    const custom = createUiProxy({ eventMarkerPrefix: '__custom_' });
    expect(custom.eventMarker('onClick')).toBe('__custom_onClick__');
  });
});

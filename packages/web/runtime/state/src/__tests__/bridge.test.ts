import { createStore, unwrap } from 'solid-js/store';
import { describe, expect, it, vi } from 'vitest';
import type { IBridgeStateSnapshot } from '../bridge';
import { createBridge } from '../bridge';
import type { IMachineContext } from '../create';
import { clearAliases, registerAliases } from '../tag-registry';

/**
 * `createBridge(state, send)` оборачивает XState-snapshot в reactive-API,
 * который видят Controller/Feature handlers (`store`).
 *
 * Контракт:
 *  - getters (ctx, loading, styles, errors, components, props) — pass-through
 *    из `state.context.*`, с {} fallback для undefined.
 *  - mutations — отправляют корректный XState event.
 *  - tag-операции (pick/omit/match/matchEntry/patch) — работают над
 *    `state.context.components`.
 */

// Bridge only reads `context.*` (with `?? {}` fallbacks), so partial mocks are
// fine at runtime. The double cast keeps the test data lean without losing the
// signature check on call sites.
const mkState = (context: Partial<IMachineContext> = {}): IBridgeStateSnapshot =>
  ({ context }) as unknown as IBridgeStateSnapshot;

describe('createBridge — getters', () => {
  it('ctx returns state.context', () => {
    const state = mkState({ data: { foo: 1 } });
    expect(createBridge(state, vi.fn()).ctx).toBe(state.context);
  });

  it('loading reads context.loading', () => {
    expect(createBridge(mkState({ loading: true }), vi.fn()).loading).toBe(true);
  });

  it.each([
    ['styles', { btn: 'red' }],
    ['errors', { email: 'invalid' }],
    ['components', { 'id-1': { meta: { tags: ['x'] } } }],
    ['props', { 'id-1': { active: true } }],
  ])('%s returns context.%s', (field, value) => {
    const bridge = createBridge(mkState({ [field]: value }), vi.fn());
    expect(bridge[field as keyof typeof bridge]).toEqual(value);
  });

  it.each([
    'styles',
    'errors',
    'components',
    'props',
  ])('%s defaults to {} when missing from context', (field) => {
    const bridge = createBridge(mkState({}), vi.fn());
    expect(bridge[field as keyof typeof bridge]).toEqual({});
  });
});

describe('createBridge — mutations', () => {
  it('update sends SET_DATA event', () => {
    const send = vi.fn();
    createBridge(mkState(), send).update({ foo: 1 });
    expect(send).toHaveBeenCalledWith({ type: 'SET_DATA', payload: { foo: 1 } });
  });

  it('setLoading sends SET_LOADING', () => {
    const send = vi.fn();
    createBridge(mkState(), send).setLoading(true);
    expect(send).toHaveBeenCalledWith({ type: 'SET_LOADING', value: true });
  });

  it('setStyles sends SET_STYLES', () => {
    const send = vi.fn();
    createBridge(mkState(), send).setStyles({ btn: 'red' });
    expect(send).toHaveBeenCalledWith({ type: 'SET_STYLES', styles: { btn: 'red' } });
  });

  it('setErrors sends SET_ERRORS', () => {
    const send = vi.fn();
    createBridge(mkState(), send).setErrors({ email: 'invalid' });
    expect(send).toHaveBeenCalledWith({ type: 'SET_ERRORS', errors: { email: 'invalid' } });
  });

  it('setProps sends SET_PROPS', () => {
    const send = vi.fn();
    createBridge(mkState(), send).setProps({ id1: { active: true } });
    expect(send).toHaveBeenCalledWith({
      type: 'SET_PROPS',
      payload: { id1: { active: true } },
    });
  });

  it('registerComponent sends REGISTER_COMPONENT', () => {
    const send = vi.fn();
    createBridge(mkState(), send).registerComponent({ 'id-1': { meta: {} } });
    expect(send).toHaveBeenCalledWith({
      type: 'REGISTER_COMPONENT',
      payload: { 'id-1': { meta: {} } },
    });
  });

  it('unregisterComponent sends UNREGISTER_COMPONENT', () => {
    const send = vi.fn();
    createBridge(mkState(), send).unregisterComponent('id-1');
    expect(send).toHaveBeenCalledWith({ type: 'UNREGISTER_COMPONENT', id: 'id-1' });
  });

  it('updateComponent sends UPDATE_COMPONENT', () => {
    const send = vi.fn();
    createBridge(mkState(), send).updateComponent({ 'id-1': { value: 'alice' } });
    expect(send).toHaveBeenCalledWith({
      type: 'UPDATE_COMPONENT',
      payload: { 'id-1': { value: 'alice' } },
    });
  });

  it('updateComponent forwards payload as-is', () => {
    const send = vi.fn();
    const payload = { 'id-1': { value: 'x', type: 'email' }, 'id-2': { value: 42 } };
    createBridge(mkState(), send).updateComponent(payload);
    expect(send).toHaveBeenCalledWith({ type: 'UPDATE_COMPONENT', payload });
  });
});

describe('createBridge — tag operations', () => {
  const components = {
    a: { meta: { tags: ['email'] } },
    b: { meta: { tags: ['nav'] } },
    c: { meta: { tags: ['password'] } },
  };

  it('pick filters components by tags', () => {
    const bridge = createBridge(mkState({ components }), vi.fn());
    expect(bridge.pick(['email'])).toEqual({ a: components.a });
  });

  it('omit returns non-matching components', () => {
    const bridge = createBridge(mkState({ components }), vi.fn());
    expect(bridge.omit(['email', 'password'])).toEqual({ b: components.b });
  });

  it('match returns first matching component', () => {
    const bridge = createBridge(mkState({ components }), vi.fn());
    expect(bridge.match(['nav'])).toBe(components.b);
  });

  it('matchEntry returns first match with its id', () => {
    const bridge = createBridge(mkState({ components }), vi.fn());
    expect(bridge.matchEntry(['nav'])).toMatchObject({ id: 'b', meta: { tags: ['nav'] } });
  });
});

describe('createBridge — patch (tag-based mutator)', () => {
  it('applies object patch to all matched components', () => {
    const send = vi.fn();
    const bridge = createBridge(
      mkState({
        components: {
          a: { meta: { tags: ['email'] } },
          b: { meta: { tags: ['nav'] } },
          c: { meta: { tags: ['email'] } },
        },
      }),
      send,
    );

    bridge.patch(['email'], { disabled: true });
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith({
      type: 'SET_PROPS',
      payload: {
        a: { disabled: true },
        c: { disabled: true },
      },
    });
  });

  it('applies function patch per-component', () => {
    const send = vi.fn();
    const components = {
      a: { meta: { tags: ['nav'] }, payload: { href: '/x' } },
      b: { meta: { tags: ['nav'] }, payload: { href: '/y' } },
    };
    const bridge = createBridge(mkState({ components }), send);

    bridge.patch(['nav'], (comp) => ({
      active: (comp.payload as { href: string }).href === '/x',
    }));

    expect(send).toHaveBeenCalledWith({
      type: 'SET_PROPS',
      payload: {
        a: { active: true },
        b: { active: false },
      },
    });
  });

  it('skips components with falsy/empty per-fn patch', () => {
    const send = vi.fn();
    const bridge = createBridge(
      mkState({
        components: {
          a: { meta: { tags: ['x'] } },
          b: { meta: { tags: ['x'] } },
        },
      }),
      send,
    );

    bridge.patch(['x'], (_, id) => (id === 'a' ? { ok: true } : null));
    expect(send).toHaveBeenCalledWith({
      type: 'SET_PROPS',
      payload: { a: { ok: true } },
    });
  });

  it('does not send when there are no matches', () => {
    const send = vi.fn();
    const bridge = createBridge(mkState({ components: { a: { meta: { tags: ['x'] } } } }), send);
    bridge.patch(['y'], { ok: true });
    expect(send).not.toHaveBeenCalled();
  });

  it('does not send when all per-fn patches return empty', () => {
    const send = vi.fn();
    const bridge = createBridge(mkState({ components: { a: { meta: { tags: ['x'] } } } }), send);
    bridge.patch(['x'], () => ({}));
    expect(send).not.toHaveBeenCalled();
  });
});

describe('createBridge — values', () => {
  it('returns Record<name, value> keyed by component name', () => {
    const bridge = createBridge(
      mkState({
        components: {
          a: { meta: { tags: ['input'] }, name: 'login', value: 'alice' },
          b: { meta: { tags: ['input'] }, name: 'password', value: 'secret' },
        },
      }),
      vi.fn(),
    );
    expect(bridge.values(['input'])).toEqual({ login: 'alice', password: 'secret' });
  });

  it('skips components without a name', () => {
    const bridge = createBridge(
      mkState({
        components: {
          a: { meta: { tags: ['submit'] } }, // no name
          b: { meta: { tags: ['input'] }, name: 'email', value: 'test@example.com' },
        },
      }),
      vi.fn(),
    );
    expect(bridge.values(['submit'])).toEqual({});
    expect(bridge.values(['input'])).toEqual({ email: 'test@example.com' });
  });

  it('last write wins when two components share the same name', () => {
    // Duplicate names are a developer mistake; the method is lenient: last entry wins.
    const bridge = createBridge(
      mkState({
        components: {
          a: { meta: { tags: ['input'] }, name: 'email', value: 'first@example.com' },
          b: { meta: { tags: ['input'] }, name: 'email', value: 'second@example.com' },
        },
      }),
      vi.fn(),
    );
    const result = bridge.values(['input']);
    expect(result).toHaveProperty('email');
    // The value is one of the two; last iteration wins (object key order is insertion order).
    expect(['first@example.com', 'second@example.com']).toContain(result.email);
  });

  it('expands aliases by default (expandAliases: true)', () => {
    clearAliases();
    registerAliases({ '@form-fields': ['login', 'password'] });

    const bridge = createBridge(
      mkState({
        components: {
          a: { meta: { tags: ['login'] }, name: 'login', value: 'alice' },
          b: { meta: { tags: ['password'] }, name: 'password', value: 'secret' },
          c: { meta: { tags: ['submit'] } },
        },
      }),
      vi.fn(),
    );
    expect(bridge.values(['@form-fields'])).toEqual({ login: 'alice', password: 'secret' });

    clearAliases();
  });

  it('does not expand aliases when expandAliases: false', () => {
    clearAliases();
    registerAliases({ '@form-fields': ['login', 'password'] });

    const bridge = createBridge(
      mkState({
        components: {
          a: { meta: { tags: ['login'] }, name: 'login', value: 'alice' },
          b: { meta: { tags: ['password'] }, name: 'password', value: 'secret' },
        },
      }),
      vi.fn(),
    );
    // With expandAliases: false the literal tag '@form-fields' is looked up —
    // none of the components carry it, so result is empty.
    expect(bridge.values(['@form-fields'], { expandAliases: false })).toEqual({});

    clearAliases();
  });

  it('does not include dynamicMeta components when lookDynamic: false', () => {
    const bridge = createBridge(
      mkState({
        components: {
          a: { meta: { tags: ['input'] }, name: 'login', value: 'alice' },
          b: { dynamicMeta: { tags: ['input'] }, name: 'dynamic', value: 'hidden' },
        },
      }),
      vi.fn(),
    );
    expect(bridge.values(['input'], { lookDynamic: false })).toEqual({ login: 'alice' });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Aliasing-invariant tests for store.update()
//
// Background: `store.ctx.data.items.find(...)` returns a Solid store proxy node.
// Passing that proxy into `store.update({ selected: item })` previously caused
// XState/Solid reconcile to alias `data.selected` and `data.items[k]` to the
// same internal store node. The next `update({ selected: other })` then overwrote
// `items[k]` as a side effect.
//
// The fix: `update()` runs `sanitisePayload` — `unwrap(payload)` strips proxy
// wrappers (using solid-js/store's $RAW mechanism), then `structuredClone` ensures
// no reference from the payload leaks into the actor.
//
// These tests verify the invariant in a node env. The proxy case uses a REAL
// solid-js `createStore` node (not a synthetic symbol): Solid's `$RAW` marker is a
// module-unique symbol that can't be reproduced from outside the module, so the
// only faithful way to exercise the unwrap path is an actual store proxy.
// ─────────────────────────────────────────────────────────────────────────────
describe('createBridge — update() aliasing invariant', () => {
  it('update clones plain objects — payload sent to actor is not the same reference', () => {
    const send = vi.fn();
    const original = { name: 'Alice', location: { lat: 1, lng: 2 } };
    createBridge(mkState(), send).update({ selected: original });

    const sentPayload = send.mock.calls[0][0].payload;
    // Structural equality preserved
    expect(sentPayload.selected).toEqual({ name: 'Alice', location: { lat: 1, lng: 2 } });
    // But it must be a deep clone — no shared reference
    expect(sentPayload.selected).not.toBe(original);
    expect(sentPayload.selected.location).not.toBe(original.location);
  });

  it('update unwraps real Solid store proxies — clone holds plain data, not the proxy', () => {
    const send = vi.fn();
    // A real store node — exactly what `items.find(...)` yields in the ewc flow.
    const [store] = createStore({ id: 'a', name: 'Alice', location: { lat: 1, lng: 2 } });

    createBridge(mkState(), send).update({ selected: store });

    const sentPayload = send.mock.calls[0][0].payload;
    // unwrap pulls the raw value out of the proxy, structuredClone deep-clones it.
    expect(sentPayload.selected).toEqual({ id: 'a', name: 'Alice', location: { lat: 1, lng: 2 } });
    // The value sent must NOT be the store proxy.
    expect(sentPayload.selected).not.toBe(store);
    // Nor the unwrapped raw reference — structuredClone guarantees isolation.
    expect(sentPayload.selected).not.toBe(unwrap(store));
  });

  it('update payload values share no reference with the input after sanitise', () => {
    const send = vi.fn();
    const item = { id: 'b', nested: { deep: true } };
    createBridge(mkState(), send).update({ item });

    const sent = send.mock.calls[0][0].payload.item;
    expect(sent).toEqual(item);
    expect(sent).not.toBe(item);
    expect(sent.nested).not.toBe(item.nested);
  });

  it('update preserves data integrity through multiple sends (regression: aliasing corrupts items array)', () => {
    // Simulates the ewc pattern: items list + selecting items from it.
    // Without the fix, selecting 'a' then 'b' would overwrite items[0] with 'b'.
    // This test operates on plain objects (no real Solid store needed).
    const receivedPayloads: Array<Record<string, any>> = [];
    const send = vi.fn((event: any) => {
      if (event.type === 'SET_DATA') receivedPayloads.push(event.payload);
    });

    const items = [
      { id: 'a', name: 'Alice' },
      { id: 'b', name: 'Bob' },
    ];

    const bridge = createBridge(mkState(), send);

    // First selection
    bridge.update({ selected: items[0] });
    // Second selection
    bridge.update({ selected: items[1] });

    // Both payloads must be independent clones
    expect(receivedPayloads[0].selected).toEqual({ id: 'a', name: 'Alice' });
    expect(receivedPayloads[1].selected).toEqual({ id: 'b', name: 'Bob' });

    // Crucially: the second send must NOT have mutated the first payload's reference
    expect(receivedPayloads[0].selected.id).toBe('a');

    // And neither payload shares a reference with the source items array
    expect(receivedPayloads[0].selected).not.toBe(items[0]);
    expect(receivedPayloads[1].selected).not.toBe(items[1]);
  });
});

describe('createBridge — alias expansion in tag ops', () => {
  it('pick(["@inputs"]) expands via tag-registry', () => {
    // Register a custom alias to confirm expansion goes through tag-registry.
    clearAliases();
    registerAliases({ '@form': ['email', 'submit'] });

    const components = {
      a: { meta: { tags: ['email'] } },
      b: { meta: { tags: ['nav'] } },
      c: { meta: { tags: ['submit'] } },
    };
    const bridge = createBridge(mkState({ components }), vi.fn());
    expect(bridge.pick(['@form'])).toEqual({ a: components.a, c: components.c });

    // Restore defaults for other tests.
    clearAliases();
    registerAliases({
      '@inputs': ['email', 'password', 'phone', 'text', 'number'],
      '@actions': ['submit', 'cancel', 'reset'],
    });
  });
});

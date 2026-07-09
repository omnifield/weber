import { describe, expect, it } from 'vitest';
import { createActor } from 'xstate';
import type { IBaseStateSchema } from '../create';
import { createState } from '../create';

/**
 * `createState(schema)` строит XState-машину из HCA-схемы. Тесты прогоняют
 * реальную машину через `createActor` и проверяют:
 *  - initial state / states присутствуют;
 *  - `__GOTO_<state>__` events работают как переходы (используется внутри
 *    state.set из StateApi);
 *  - универсальные store-events корректно мутируют context.
 *
 * Регрессии тут ломают весь HCA-runtime — это сама основа FSM.
 */

const makeActor = (schema: IBaseStateSchema) => {
  const actor = createActor(createState(schema)).start();
  return actor;
};

describe('createState — initial / states / transitions', () => {
  it('respects initial state', () => {
    const actor = makeActor({
      initial: 'busy',
      states: { idle: {}, busy: {} },
    });
    expect(actor.getSnapshot().value).toBe('busy');
  });

  it('initial context is populated with defaults', () => {
    const actor = makeActor({
      initial: 'idle',
      states: { idle: {} },
    });
    const ctx = actor.getSnapshot().context as Record<string, unknown>;
    expect(ctx).toMatchObject({
      data: {},
      loading: false,
      errors: {},
      styles: {},
      components: {},
      props: {},
    });
  });

  it('user context is merged into context.data', () => {
    const actor = makeActor({
      initial: 'idle',
      states: { idle: {} },
      context: { username: 'alice' },
    });
    const ctx = actor.getSnapshot().context as { data: { username: string } };
    expect(ctx.data).toEqual({ username: 'alice' });
  });

  it('__GOTO_<state>__ event transitions to that state', () => {
    const actor = makeActor({
      initial: 'idle',
      states: { idle: {}, busy: {}, done: {} },
    });
    expect(actor.getSnapshot().value).toBe('idle');
    actor.send({ type: '__GOTO_busy__' });
    expect(actor.getSnapshot().value).toBe('busy');
    actor.send({ type: '__GOTO_done__' });
    expect(actor.getSnapshot().value).toBe('done');
  });

  it('GOTO for non-existent state is ignored (no crash)', () => {
    const actor = makeActor({
      initial: 'idle',
      states: { idle: {} },
    });
    actor.send({ type: '__GOTO_nope__' });
    expect(actor.getSnapshot().value).toBe('idle');
  });
});

describe('createState — SET_DATA', () => {
  it('merges payload into context.data', () => {
    const actor = makeActor({
      initial: 'idle',
      states: { idle: {} },
      context: { existing: 1 },
    });

    actor.send({ type: 'SET_DATA', payload: { added: 2 } });
    const ctx = actor.getSnapshot().context as { data: Record<string, number> };
    expect(ctx.data).toEqual({ existing: 1, added: 2 });
  });

  it('SET_DATA overrides existing keys', () => {
    const actor = makeActor({
      initial: 'idle',
      states: { idle: {} },
      context: { count: 1 },
    });
    actor.send({ type: 'SET_DATA', payload: { count: 99 } });
    const ctx = actor.getSnapshot().context as { data: { count: number } };
    expect(ctx.data.count).toBe(99);
  });
});

describe('createState — SET_LOADING / SET_STYLES / SET_ERRORS', () => {
  it('SET_LOADING toggles flag', () => {
    const actor = makeActor({ initial: 'idle', states: { idle: {} } });
    actor.send({ type: 'SET_LOADING', value: true });
    expect((actor.getSnapshot().context as { loading: boolean }).loading).toBe(true);
    actor.send({ type: 'SET_LOADING', value: false });
    expect((actor.getSnapshot().context as { loading: boolean }).loading).toBe(false);
  });

  it('SET_STYLES replaces styles object', () => {
    const actor = makeActor({ initial: 'idle', states: { idle: {} } });
    actor.send({ type: 'SET_STYLES', styles: { btn: 'red' } });
    expect((actor.getSnapshot().context as { styles: object }).styles).toEqual({ btn: 'red' });
    actor.send({ type: 'SET_STYLES', styles: { btn: 'blue' } });
    expect((actor.getSnapshot().context as { styles: object }).styles).toEqual({ btn: 'blue' });
  });

  it('SET_ERRORS replaces errors object', () => {
    const actor = makeActor({ initial: 'idle', states: { idle: {} } });
    actor.send({ type: 'SET_ERRORS', errors: { email: 'invalid' } });
    expect((actor.getSnapshot().context as { errors: object }).errors).toEqual({
      email: 'invalid',
    });
  });
});

describe('createState — REGISTER_COMPONENT / UNREGISTER_COMPONENT', () => {
  it('REGISTER_COMPONENT merges into components', () => {
    const actor = makeActor({ initial: 'idle', states: { idle: {} } });
    actor.send({
      type: 'REGISTER_COMPONENT',
      payload: { 'id-1': { meta: { tags: ['email'] } } },
    });
    actor.send({
      type: 'REGISTER_COMPONENT',
      payload: { 'id-2': { meta: { tags: ['nav'] } } },
    });
    const ctx = actor.getSnapshot().context as { components: Record<string, unknown> };
    expect(Object.keys(ctx.components)).toEqual(['id-1', 'id-2']);
  });

  it('UNREGISTER_COMPONENT removes the entry from components AND props', () => {
    const actor = makeActor({ initial: 'idle', states: { idle: {} } });
    actor.send({
      type: 'REGISTER_COMPONENT',
      payload: { 'id-1': { meta: {} } },
    });
    actor.send({ type: 'SET_PROPS', payload: { 'id-1': { active: true } } });

    actor.send({ type: 'UNREGISTER_COMPONENT', id: 'id-1' });
    const ctx = actor.getSnapshot().context as {
      components: Record<string, unknown>;
      props: Record<string, unknown>;
    };
    expect(ctx.components).toEqual({});
    expect(ctx.props).toEqual({});
  });
});

describe('createState — UPDATE_COMPONENT', () => {
  it('merges patch into existing components[id]', () => {
    const actor = makeActor({ initial: 'idle', states: { idle: {} } });
    actor.send({
      type: 'REGISTER_COMPONENT',
      payload: { 'id-1': { meta: { tags: ['email'] }, name: 'email' } },
    });

    actor.send({ type: 'UPDATE_COMPONENT', payload: { 'id-1': { value: 'alice@example.com' } } });

    const ctx = actor.getSnapshot().context as { components: Record<string, any> };
    expect(ctx.components['id-1'].value).toBe('alice@example.com');
  });

  it('preserves other fields (meta) on partial patch', () => {
    const actor = makeActor({ initial: 'idle', states: { idle: {} } });
    actor.send({
      type: 'REGISTER_COMPONENT',
      payload: { 'id-1': { meta: { tags: ['email'] }, name: 'email', type: 'text' } },
    });

    actor.send({ type: 'UPDATE_COMPONENT', payload: { 'id-1': { value: 'alice' } } });

    const ctx = actor.getSnapshot().context as { components: Record<string, any> };
    expect(ctx.components['id-1'].meta).toEqual({ tags: ['email'] });
    expect(ctx.components['id-1'].name).toBe('email');
    expect(ctx.components['id-1'].type).toBe('text');
    expect(ctx.components['id-1'].value).toBe('alice');
  });

  it('skips unknown id — no crash, no ghost entry', () => {
    const actor = makeActor({ initial: 'idle', states: { idle: {} } });
    // No REGISTER_COMPONENT — 'id-ghost' is unknown.
    actor.send({ type: 'UPDATE_COMPONENT', payload: { 'id-ghost': { value: 'x' } } });

    const ctx = actor.getSnapshot().context as { components: Record<string, any> };
    expect(ctx.components).toEqual({});
  });

  it('patches multiple ids in one payload', () => {
    const actor = makeActor({ initial: 'idle', states: { idle: {} } });
    actor.send({
      type: 'REGISTER_COMPONENT',
      payload: {
        'id-1': { meta: { tags: ['email'] }, name: 'email' },
        'id-2': { meta: { tags: ['password'] }, name: 'password' },
      },
    });

    actor.send({
      type: 'UPDATE_COMPONENT',
      payload: { 'id-1': { value: 'alice' }, 'id-2': { value: 'secret' } },
    });

    const ctx = actor.getSnapshot().context as { components: Record<string, any> };
    expect(ctx.components['id-1'].value).toBe('alice');
    expect(ctx.components['id-2'].value).toBe('secret');
  });

  it('multiple sequential UPDATE_COMPONENT events accumulate', () => {
    const actor = makeActor({ initial: 'idle', states: { idle: {} } });
    actor.send({
      type: 'REGISTER_COMPONENT',
      payload: { 'id-1': { meta: { tags: ['input'] }, name: 'search' } },
    });

    actor.send({ type: 'UPDATE_COMPONENT', payload: { 'id-1': { value: 'foo' } } });
    actor.send({ type: 'UPDATE_COMPONENT', payload: { 'id-1': { value: 'foobar' } } });

    const ctx = actor.getSnapshot().context as { components: Record<string, any> };
    expect(ctx.components['id-1'].value).toBe('foobar');
  });

  it('does not touch context.data namespace after UPDATE_COMPONENT', () => {
    const actor = makeActor({
      initial: 'idle',
      states: { idle: {} },
      context: { counter: 0 },
    });
    actor.send({
      type: 'REGISTER_COMPONENT',
      payload: { 'id-1': { meta: { tags: ['input'] }, name: 'email' } },
    });

    actor.send({ type: 'UPDATE_COMPONENT', payload: { 'id-1': { value: 'test@example.com' } } });

    const ctx = actor.getSnapshot().context as { data: { counter: number } };
    expect(ctx.data).toEqual({ counter: 0 });
  });
});

describe('createState — SET_PROPS', () => {
  it('merges per-id patch into existing props (does NOT replace)', () => {
    const actor = makeActor({ initial: 'idle', states: { idle: {} } });

    actor.send({ type: 'SET_PROPS', payload: { 'id-1': { active: true } } });
    actor.send({ type: 'SET_PROPS', payload: { 'id-1': { disabled: false } } });

    const ctx = actor.getSnapshot().context as {
      props: Record<string, { active: boolean; disabled: boolean }>;
    };
    expect(ctx.props['id-1']).toEqual({ active: true, disabled: false });
  });

  it('writes multiple ids at once', () => {
    const actor = makeActor({ initial: 'idle', states: { idle: {} } });
    actor.send({
      type: 'SET_PROPS',
      payload: { a: { x: 1 }, b: { y: 2 } },
    });

    const ctx = actor.getSnapshot().context as {
      props: Record<string, Record<string, number>>;
    };
    expect(ctx.props).toEqual({ a: { x: 1 }, b: { y: 2 } });
  });

  it('later writes override earlier per-key (within same id)', () => {
    const actor = makeActor({ initial: 'idle', states: { idle: {} } });
    actor.send({ type: 'SET_PROPS', payload: { 'id-1': { count: 1 } } });
    actor.send({ type: 'SET_PROPS', payload: { 'id-1': { count: 99 } } });
    const ctx = actor.getSnapshot().context as {
      props: Record<string, { count: number }>;
    };
    expect(ctx.props['id-1'].count).toBe(99);
  });
});

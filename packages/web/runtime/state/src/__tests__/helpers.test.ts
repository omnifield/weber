import { afterEach, describe, expect, it } from 'vitest';
import { matchByTags, matchEntryByTags, omitByTags, pickByTags } from '../helpers';
import { clearAliases, registerAliases } from '../tag-registry';

/**
 * Tag-операции — сердце Bridge'а (`store.pick`/`omit`/`match`/`matchEntry`).
 * Контракт фиксирован: handler'ы Controller'ов и Feature'ов опираются на
 * детерминированное поведение pick/match. Регрессии тут ломают весь HCA-проект.
 */

const mkComp = (tags: string[], extras: { dynamicTags?: string[]; [k: string]: unknown } = {}) => ({
  meta: { tags },
  ...(extras.dynamicTags ? { dynamicMeta: { tags: extras.dynamicTags } } : {}),
  ...extras,
});

afterEach(() => {
  // tag-registry — module-level singleton. Чистим между тестами, чтобы один
  // не загрязнял другой через registerAliases. См. S-A-1 finding.
  clearAliases();
  registerAliases({
    '@inputs': ['email', 'password', 'phone', 'text', 'number'],
    '@actions': ['submit', 'cancel', 'reset'],
  });
});

describe('pickByTags', () => {
  it('returns only components whose meta.tags intersect target', () => {
    const data = {
      a: mkComp(['email']),
      b: mkComp(['nav']),
      c: mkComp(['password']),
    };
    expect(pickByTags(data, ['email', 'password'])).toEqual({
      a: data.a,
      c: data.c,
    });
  });

  it('considers dynamicMeta.tags by default (lookDynamic: true)', () => {
    const data = {
      a: mkComp(['email']),
      b: mkComp(['plain'], { dynamicTags: ['nav'] }),
    };
    expect(pickByTags(data, ['nav'])).toEqual({ b: data.b });
  });

  it('skips dynamicMeta.tags when lookDynamic: false', () => {
    const data = {
      a: mkComp(['plain'], { dynamicTags: ['nav'] }),
    };
    expect(pickByTags(data, ['nav'], { lookDynamic: false })).toEqual({});
  });

  it('expands alias-tag queries (@inputs → email/password/...)', () => {
    const data = {
      a: mkComp(['email']),
      b: mkComp(['nav']),
      c: mkComp(['password']),
    };
    expect(pickByTags(data, ['@inputs'])).toEqual({ a: data.a, c: data.c });
  });

  it('matches @-tag literally too (component declared @inputs in meta)', () => {
    const data = {
      a: mkComp(['@inputs']),
      b: mkComp(['nav']),
    };
    expect(pickByTags(data, ['@inputs'])).toEqual({ a: data.a });
  });

  it('skips alias expansion when expandAliases: false', () => {
    const data = {
      a: mkComp(['email']),
      b: mkComp(['@inputs']),
    };
    expect(pickByTags(data, ['@inputs'], { expandAliases: false })).toEqual({ b: data.b });
  });

  it('returns empty when no tags match', () => {
    expect(pickByTags({ a: mkComp(['x']) }, ['y'])).toEqual({});
  });

  it('returns empty for empty target', () => {
    expect(pickByTags({ a: mkComp(['x']) }, [])).toEqual({});
  });
});

describe('omitByTags', () => {
  it('returns components without target tags (inverse of pick)', () => {
    const data = {
      a: mkComp(['email']),
      b: mkComp(['nav']),
      c: mkComp(['password']),
    };
    expect(omitByTags(data, ['email', 'password'])).toEqual({ b: data.b });
  });

  it('respects expandAliases (omit @inputs removes email + password)', () => {
    const data = {
      a: mkComp(['email']),
      b: mkComp(['nav']),
      c: mkComp(['password']),
    };
    expect(omitByTags(data, ['@inputs'])).toEqual({ b: data.b });
  });
});

describe('matchByTags', () => {
  it('returns first matching component', () => {
    const data = {
      a: mkComp(['nav']),
      b: mkComp(['email']),
      c: mkComp(['email']),
    };
    expect(matchByTags(data, ['email'])).toBe(data.b);
  });

  it('returns undefined when no match', () => {
    expect(matchByTags({ a: mkComp(['x']) }, ['y'])).toBeUndefined();
  });
});

describe('matchEntryByTags', () => {
  it('returns first match merged with its id', () => {
    const data = {
      a: mkComp(['nav']),
      b: mkComp(['email']),
    };
    const entry = matchEntryByTags(data, ['email']);
    expect(entry).toMatchObject({ id: 'b', meta: { tags: ['email'] } });
  });

  it('returns undefined when no match', () => {
    expect(matchEntryByTags({ a: mkComp(['x']) }, ['y'])).toBeUndefined();
  });
});

describe('tag-ops — defensive defaults', () => {
  it('treats missing meta as empty tags', () => {
    const data = {
      a: {
        /* no meta */
      } as unknown as ReturnType<typeof mkComp>,
      b: mkComp(['email']),
    };
    expect(pickByTags(data, ['email'])).toEqual({ b: data.b });
  });

  it('treats missing meta.tags as empty', () => {
    const data = {
      a: { meta: {} } as unknown as ReturnType<typeof mkComp>,
      b: mkComp(['email']),
    };
    expect(pickByTags(data, ['email'])).toEqual({ b: data.b });
  });
});

import { afterEach, describe, expect, it } from 'vitest';
import { clearAliases, expandTags, getAliases, registerAliases } from '../tag-registry';

/**
 * Tag-registry — singleton с алиасами (`@inputs`, `@actions`, custom). Эти
 * алиасы раскрываются в helpers.ts и определяют, какие компоненты найдёт
 * `pick(['@inputs'])`.
 *
 * Регрессии: цикл в раскрытии (бесконечный loop), дефолтные алиасы протекают
 * между тестами, очистка не работает.
 */

afterEach(() => {
  // Singleton — между тестами обязательно reset, иначе предыдущий
  // registerAliases() протекает.
  clearAliases();
  registerAliases({
    '@inputs': ['email', 'password', 'phone', 'text', 'number'],
    '@actions': ['submit', 'cancel', 'reset'],
  });
});

describe('default aliases', () => {
  it('@inputs expands to known tags', () => {
    expect(expandTags(['@inputs'])).toEqual(
      expect.arrayContaining(['@inputs', 'email', 'password', 'phone', 'text', 'number']),
    );
  });

  it('@actions expands', () => {
    expect(expandTags(['@actions'])).toEqual(
      expect.arrayContaining(['@actions', 'submit', 'cancel', 'reset']),
    );
  });

  it('non-alias tag is returned as-is', () => {
    expect(expandTags(['nav'])).toEqual(['nav']);
  });
});

describe('registerAliases / getAliases', () => {
  it('merges new aliases into the registry', () => {
    registerAliases({ '@nav': ['header', 'sidebar'] });
    expect(getAliases()['@nav']).toEqual(['header', 'sidebar']);
  });

  it('overrides existing alias on collision', () => {
    registerAliases({ '@inputs': ['custom'] });
    expect(getAliases()['@inputs']).toEqual(['custom']);
  });

  it('keeps unrelated aliases untouched', () => {
    registerAliases({ '@new': ['x'] });
    expect(getAliases()['@actions']).toEqual(['submit', 'cancel', 'reset']);
  });
});

describe('clearAliases', () => {
  it('empties the registry', () => {
    clearAliases();
    expect(getAliases()).toEqual({});
  });

  it('expandTags returns identity after clear', () => {
    clearAliases();
    expect(expandTags(['@inputs'])).toEqual(['@inputs']);
  });
});

describe('expandTags', () => {
  it('expands aliases recursively (alias of alias)', () => {
    registerAliases({ '@form': ['@inputs', '@actions'] });
    const out = expandTags(['@form']);
    expect(out).toEqual(
      expect.arrayContaining(['@form', '@inputs', '@actions', 'email', 'password', 'submit']),
    );
  });

  it('protects against direct cycles (@a → @a)', () => {
    registerAliases({ '@a': ['@a'] });
    expect(() => expandTags(['@a'])).not.toThrow();
    expect(expandTags(['@a'])).toEqual(['@a']);
  });

  it('protects against indirect cycles (@a → @b → @a)', () => {
    registerAliases({ '@a': ['@b'], '@b': ['@a'] });
    expect(() => expandTags(['@a'])).not.toThrow();
    expect(expandTags(['@a'])).toEqual(expect.arrayContaining(['@a', '@b']));
  });

  it('deduplicates result', () => {
    registerAliases({ '@dup': ['email', 'email', 'phone'] });
    const out = expandTags(['@dup']);
    const emailCount = out.filter((t) => t === 'email').length;
    expect(emailCount).toBe(1);
  });

  it('expands multiple input tags at once', () => {
    const out = expandTags(['@inputs', '@actions']);
    expect(out).toEqual(expect.arrayContaining(['email', 'password', 'submit', 'cancel']));
  });

  it('empty input returns empty output', () => {
    expect(expandTags([])).toEqual([]);
  });
});

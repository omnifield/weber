import { describe, expect, it } from 'vitest';
import { keyToString, QueryCache } from '../cache';
import type { QueryKey } from '../types';

// Простой кэш с JSON-сериализованным ключом + префиксная инвалидация.
// Тесты держат контракт: ключи структурно различимы, префикс-match
// работает по элементу (а не по подстроке), invalidate помечает
// fetchedAt=0 без удаления данных.

const mkEntry = (key: QueryKey, data: unknown = 'x') => ({
  key,
  state: { data, error: undefined, status: 'success' as const, fetchedAt: 100 },
  inFlight: null,
});

describe('QueryCache — get/set', () => {
  it('set then get returns same entry by key', () => {
    const c = new QueryCache();
    const e = mkEntry(['users', 1]);
    c.set(['users', 1], e);
    expect(c.get(['users', 1])).toBe(e);
  });

  it('miss returns undefined', () => {
    expect(new QueryCache().get(['nope'])).toBeUndefined();
  });

  it('keys with different element order are different', () => {
    const c = new QueryCache();
    c.set(['a', 'b'], mkEntry(['a', 'b'], 1));
    c.set(['b', 'a'], mkEntry(['b', 'a'], 2));
    expect((c.get(['a', 'b']) as any)?.state.data).toBe(1);
    expect((c.get(['b', 'a']) as any)?.state.data).toBe(2);
  });

  it('object-element equality is structural (stable-stringify — order-independent)', () => {
    const c = new QueryCache();
    c.set(['filter', { a: 1, b: 2 }], mkEntry(['filter', { a: 1, b: 2 }], 'A'));
    // Те же поля в том же порядке — попадание.
    expect((c.get(['filter', { a: 1, b: 2 }]) as any)?.state.data).toBe('A');
    // Другой порядок ключей в объекте — теперь тоже попадание (stable sort).
    // До P1 #2 это был cache-miss — баг был задокументирован тестом как
    // "known limitation". Теперь — инвариант: семантически равные input'ы
    // дают один cache-entry.
    expect((c.get(['filter', { b: 2, a: 1 }]) as any)?.state.data).toBe('A');
  });

  it('stable-stringify рекурсивный — вложенные объекты тоже sort-independent', () => {
    const c = new QueryCache();
    c.set(['users', { filter: { age: 18, role: 'admin' } }], mkEntry(['users'], 'X'));
    expect((c.get(['users', { filter: { role: 'admin', age: 18 } }]) as any)?.state.data).toBe('X');
  });

  it('массивы остаются order-sensitive (намеренно — ["a","b"] !== ["b","a"])', () => {
    const c = new QueryCache();
    c.set(['tags', ['a', 'b']], mkEntry(['tags'], 'AB'));
    expect((c.get(['tags', ['a', 'b']]) as any)?.state.data).toBe('AB');
    expect(c.get(['tags', ['b', 'a']])).toBeUndefined();
  });
});

describe('QueryCache — delete / clear', () => {
  it('delete removes single entry', () => {
    const c = new QueryCache();
    c.set(['k'], mkEntry(['k']));
    c.delete(['k']);
    expect(c.get(['k'])).toBeUndefined();
  });

  it('clear wipes all entries', () => {
    const c = new QueryCache();
    c.set(['a'], mkEntry(['a']));
    c.set(['b'], mkEntry(['b']));
    c.clear();
    expect(c.get(['a'])).toBeUndefined();
    expect(c.get(['b'])).toBeUndefined();
  });
});

describe('QueryCache — invalidate (prefix)', () => {
  it('marks matched entries as stale (fetchedAt=0) but keeps data', () => {
    const c = new QueryCache();
    c.set(['users', 'page', 1], mkEntry(['users', 'page', 1], 'page1'));
    c.set(['users', 1], mkEntry(['users', 1], 'user1'));
    c.set(['posts', 1], mkEntry(['posts', 1], 'post1'));

    c.invalidate(['users']);

    const u1 = c.get(['users', 1]);
    const p1 = c.get(['users', 'page', 1]);
    const post = c.get(['posts', 1]);

    expect(u1?.state.fetchedAt).toBe(0);
    expect(u1?.state.data).toBe('user1'); // данные не стёрты
    expect(p1?.state.fetchedAt).toBe(0);
    expect(post?.state.fetchedAt).toBe(100); // другой префикс — нетронут
  });

  it('exact-key prefix matches only that key', () => {
    const c = new QueryCache();
    c.set(['x'], mkEntry(['x']));
    c.set(['x', 1], mkEntry(['x', 1]));
    c.invalidate(['x']);
    expect(c.get(['x'])?.state.fetchedAt).toBe(0);
    expect(c.get(['x', 1])?.state.fetchedAt).toBe(0);
  });

  it('longer prefix than key is no-match (no crash)', () => {
    const c = new QueryCache();
    c.set(['a'], mkEntry(['a']));
    c.invalidate(['a', 'b', 'c']);
    expect(c.get(['a'])?.state.fetchedAt).toBe(100);
  });

  it('substring-like elements do not falsely match (per-element compare)', () => {
    const c = new QueryCache();
    c.set(['users'], mkEntry(['users']));
    c.set(['userspace'], mkEntry(['userspace']));
    c.invalidate(['users']);
    expect(c.get(['users'])?.state.fetchedAt).toBe(0);
    expect(c.get(['userspace'])?.state.fetchedAt).toBe(100);
  });
});

describe('keyToString', () => {
  it('serializes via JSON.stringify', () => {
    expect(keyToString(['users', 1])).toBe('["users",1]');
  });
});

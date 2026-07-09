import { describe, expect, it } from 'vitest';
import { cn, merge } from '../utils';

// cn = clsx + tailwind-merge. Контракт: фильтрует ложные значения,
// мерджит конфликты Tailwind-классов (последний выигрывает).

describe('cn', () => {
  it('joins string args with space', () => {
    expect(cn('a', 'b', 'c')).toBe('a b c');
  });

  it('ignores falsy values (undefined/null/false/empty)', () => {
    expect(cn('a', undefined, null, false, '', 'b')).toBe('a b');
  });

  it('flattens arrays', () => {
    expect(cn(['a', 'b'], 'c')).toBe('a b c');
  });

  it('supports clsx object syntax (truthy keys → keep)', () => {
    expect(cn({ a: true, b: false, c: 1 })).toBe('a c');
  });

  it('merges conflicting Tailwind classes via twMerge (last wins)', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4');
    expect(cn('text-red-500 px-2', 'text-blue-500')).toBe('px-2 text-blue-500');
  });
});

// merge = deep-merge через es-toolkit. Используется для слияния style-объектов.

describe('merge', () => {
  it('shallow-merges two flat string-maps', () => {
    expect(merge({ a: '1', b: '2' }, { b: '20', c: '3' })).toEqual({
      a: '1',
      b: '20',
      c: '3',
    });
  });

  it('second arg overrides first on key collision', () => {
    expect(merge({ x: 'a' }, { x: 'b' })).toEqual({ x: 'b' });
  });

  it('returns equivalent of obj2 when obj1 empty', () => {
    expect(merge({}, { a: '1' })).toEqual({ a: '1' });
  });

  it('returns equivalent of obj1 when obj2 empty', () => {
    expect(merge({ a: '1' }, {})).toEqual({ a: '1' });
  });
});

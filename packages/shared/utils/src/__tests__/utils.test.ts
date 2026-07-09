import { describe, expect, it } from 'vitest';
import { Utils } from '../index.js';

// ---------------------------------------------------------------------------
// Gap-филлеры: Array
// ---------------------------------------------------------------------------

describe('Utils.map', () => {
  it('transforms each element', () => {
    expect(Utils.map([1, 2, 3], (x) => x * 2)).toEqual([2, 4, 6]);
  });

  it('provides index argument', () => {
    expect(Utils.map(['a', 'b'], (_, i) => i)).toEqual([0, 1]);
  });

  it('does not mutate the source', () => {
    const src = [1, 2, 3];
    Utils.map(src, (x) => x + 10);
    expect(src).toEqual([1, 2, 3]);
  });
});

describe('Utils.filter', () => {
  it('keeps matching elements', () => {
    expect(Utils.filter([1, 2, 3, 4], (x) => x % 2 === 0)).toEqual([2, 4]);
  });

  it('returns empty array when nothing matches', () => {
    expect(Utils.filter([1, 3, 5], (x) => x > 10)).toEqual([]);
  });
});

describe('Utils.find', () => {
  it('returns first matching element', () => {
    expect(Utils.find([1, 2, 3], (x) => x > 1)).toBe(2);
  });

  it('returns undefined when nothing matches', () => {
    expect(Utils.find([1, 2, 3], (x) => x > 10)).toBeUndefined();
  });
});

describe('Utils.findIndex', () => {
  it('returns index of first matching element', () => {
    expect(Utils.findIndex([10, 20, 30], (x) => x === 20)).toBe(1);
  });

  it('returns -1 when nothing matches', () => {
    expect(Utils.findIndex([1, 2, 3], (x) => x > 100)).toBe(-1);
  });
});

describe('Utils.reduce', () => {
  it('accumulates values', () => {
    expect(Utils.reduce([1, 2, 3, 4], (acc, x) => acc + x, 0)).toBe(10);
  });

  it('works with object accumulator', () => {
    const result = Utils.reduce(
      ['a', 'b', 'a', 'c'],
      (acc, ch) => ({ ...acc, [ch]: (acc[ch] ?? 0) + 1 }),
      {} as Record<string, number>,
    );
    expect(result).toEqual({ a: 2, b: 1, c: 1 });
  });
});

describe('Utils.forEach', () => {
  it('iterates all elements', () => {
    const collected: number[] = [];
    Utils.forEach([10, 20, 30], (x) => collected.push(x));
    expect(collected).toEqual([10, 20, 30]);
  });

  it('returns void (undefined)', () => {
    expect(Utils.forEach([], () => {})).toBeUndefined();
  });
});

describe('Utils.some / Utils.every', () => {
  it('some returns true if any match', () => {
    expect(Utils.some([1, 2, 3], (x) => x === 2)).toBe(true);
    expect(Utils.some([1, 3, 5], (x) => x === 2)).toBe(false);
  });

  it('every returns true if all match', () => {
    expect(Utils.every([2, 4, 6], (x) => x % 2 === 0)).toBe(true);
    expect(Utils.every([2, 3, 6], (x) => x % 2 === 0)).toBe(false);
  });
});

describe('Utils.includes', () => {
  it('detects presence', () => {
    expect(Utils.includes([1, 2, 3], 2)).toBe(true);
    expect(Utils.includes([1, 2, 3], 5)).toBe(false);
  });

  it('respects fromIndex', () => {
    expect(Utils.includes([1, 2, 3], 1, 1)).toBe(false);
  });
});

describe('Utils.sort', () => {
  it('returns sorted copy without mutating source', () => {
    const src = [3, 1, 2];
    const sorted = Utils.sort(src);
    expect(sorted).toEqual([1, 2, 3]);
    expect(src).toEqual([3, 1, 2]);
  });

  it('accepts custom comparator', () => {
    expect(Utils.sort([3, 1, 2], (a, b) => b - a)).toEqual([3, 2, 1]);
  });
});

describe('Utils.reverse', () => {
  it('returns reversed copy without mutating source', () => {
    const src = [1, 2, 3];
    const reversed = Utils.reverse(src);
    expect(reversed).toEqual([3, 2, 1]);
    expect(src).toEqual([1, 2, 3]);
  });
});

describe('Utils.concat', () => {
  it('concatenates arrays', () => {
    expect(Utils.concat([1, 2], [3, 4], [5])).toEqual([1, 2, 3, 4, 5]);
  });

  it('works with empty arrays', () => {
    expect(Utils.concat([], [1])).toEqual([1]);
  });
});

describe('Utils.slice', () => {
  it('returns slice', () => {
    expect(Utils.slice([1, 2, 3, 4], 1, 3)).toEqual([2, 3]);
  });

  it('works with only start', () => {
    expect(Utils.slice([1, 2, 3], 2)).toEqual([3]);
  });
});

describe('Utils.join', () => {
  it('joins with separator', () => {
    expect(Utils.join([1, 2, 3], ', ')).toBe('1, 2, 3');
  });

  it('uses comma by default', () => {
    expect(Utils.join(['a', 'b', 'c'])).toBe('a,b,c');
  });
});

// ---------------------------------------------------------------------------
// Gap-филлеры: Object
// ---------------------------------------------------------------------------

describe('Utils.keys', () => {
  it('returns own enumerable keys', () => {
    expect(Utils.keys({ a: 1, b: 2 })).toEqual(['a', 'b']);
  });

  it('returns empty array for empty object', () => {
    expect(Utils.keys({})).toEqual([]);
  });
});

describe('Utils.values', () => {
  it('returns own enumerable values', () => {
    expect(Utils.values({ a: 1, b: 2 })).toEqual([1, 2]);
  });
});

describe('Utils.entries', () => {
  it('returns key-value pairs', () => {
    expect(Utils.entries({ a: 1, b: 2 })).toEqual([
      ['a', 1],
      ['b', 2],
    ]);
  });
});

describe('Utils.fromEntries', () => {
  it('builds object from pairs', () => {
    expect(Utils.fromEntries([['a', 1] as const, ['b', 2] as const])).toEqual({ a: 1, b: 2 });
  });

  it('round-trips with entries', () => {
    const obj = { x: 10, y: 20 };
    expect(Utils.fromEntries(Utils.entries(obj))).toEqual(obj);
  });
});

describe('Utils.hasKey', () => {
  it('returns true for own property', () => {
    expect(Utils.hasKey({ a: 1 }, 'a')).toBe(true);
  });

  it('returns false for missing key', () => {
    expect(Utils.hasKey({ a: 1 }, 'b')).toBe(false);
  });

  it('returns false for inherited property', () => {
    const obj = Object.create({ inherited: true });
    expect(Utils.hasKey(obj, 'inherited')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Smoke: es-toolkit re-exports доступны через Utils
// ---------------------------------------------------------------------------

describe('Utils — es-toolkit smoke', () => {
  it('Utils.groupBy is available', () => {
    expect(typeof Utils.groupBy).toBe('function');
    const result = Utils.groupBy([1, 2, 3, 4], (n) => (n % 2 === 0 ? 'even' : 'odd'));
    expect(result).toEqual({ odd: [1, 3], even: [2, 4] });
  });

  it('Utils.uniq is available', () => {
    expect(typeof Utils.uniq).toBe('function');
    expect(Utils.uniq([1, 2, 2, 3, 1])).toEqual([1, 2, 3]);
  });

  it('Utils.chunk is available', () => {
    expect(typeof Utils.chunk).toBe('function');
    expect(Utils.chunk([1, 2, 3, 4], 2)).toEqual([
      [1, 2],
      [3, 4],
    ]);
  });

  it('Utils.cloneDeep produces deep copy', () => {
    expect(typeof Utils.cloneDeep).toBe('function');
    const obj = { a: { b: 1 } };
    const clone = Utils.cloneDeep(obj);
    expect(clone).toEqual(obj);
    expect(clone).not.toBe(obj);
    expect(clone.a).not.toBe(obj.a);
  });

  it('Utils.omit removes specified keys', () => {
    expect(typeof Utils.omit).toBe('function');
    expect(Utils.omit({ a: 1, b: 2, c: 3 }, ['b'])).toEqual({ a: 1, c: 3 });
  });

  it('Utils.pick selects specified keys', () => {
    expect(typeof Utils.pick).toBe('function');
    expect(Utils.pick({ a: 1, b: 2, c: 3 }, ['a', 'c'])).toEqual({ a: 1, c: 3 });
  });

  it('Utils.isEqual compares deeply', () => {
    expect(typeof Utils.isEqual).toBe('function');
    expect(Utils.isEqual({ a: 1 }, { a: 1 })).toBe(true);
    expect(Utils.isEqual({ a: 1 }, { a: 2 })).toBe(false);
  });

  it('Utils.camelCase converts string', () => {
    expect(typeof Utils.camelCase).toBe('function');
    expect(Utils.camelCase('hello-world')).toBe('helloWorld');
  });

  it('Utils.debounce is available', () => {
    expect(typeof Utils.debounce).toBe('function');
  });

  it('Utils.clamp clamps value', () => {
    expect(typeof Utils.clamp).toBe('function');
    expect(Utils.clamp(10, 0, 5)).toBe(5);
    expect(Utils.clamp(-1, 0, 5)).toBe(0);
    expect(Utils.clamp(3, 0, 5)).toBe(3);
  });

  it('Utils.sum sums an array', () => {
    expect(typeof Utils.sum).toBe('function');
    expect(Utils.sum([1, 2, 3])).toBe(6);
  });

  it('Utils.merge deep merges objects', () => {
    expect(typeof Utils.merge).toBe('function');
    const result = Utils.merge({ a: 1, b: { c: 2 } }, { b: { d: 3 } });
    expect(result).toEqual({ a: 1, b: { c: 2, d: 3 } });
  });
});

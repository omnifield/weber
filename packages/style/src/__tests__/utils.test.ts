import { describe, expect, it } from 'vitest';
import { STATUS_VARIABLES } from '../constants';
import { cn, cva, merge } from '../utils';

describe('cn', () => {
  it('clsx + tailwind-merge: конфликтующие утилиты схлопываются (правый выигрывает)', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4');
    expect(cn('text-red-500', false && 'hidden', 'text-blue-500')).toBe('text-blue-500');
  });
});

describe('cva re-export', () => {
  it('варианты работают', () => {
    const button = cva('base', { variants: { size: { sm: 'text-sm', lg: 'text-lg' } } });
    expect(button({ size: 'sm' })).toContain('text-sm');
  });
});

describe('merge', () => {
  it('плоский merge, правый выигрывает', () => {
    expect(merge({ a: '1', b: '2' }, { b: '3' })).toEqual({ a: '1', b: '3' });
  });
});

describe('STATUS_VARIABLES', () => {
  it('канонический набор статусов', () => {
    expect(Object.keys(STATUS_VARIABLES)).toEqual(['idle', 'success', 'error', 'warning']);
    expect(STATUS_VARIABLES.error['--current-status']).toBe('var(--destructive)');
  });
});

/**
 * Unit tests for the pure zone math in zone.ts (`zoneFromRatio`).
 *
 * Pure — no Solid / DOM. Covers leaf split (0.5) and container thresholds
 * (default 0.3 / 0.7 + override).
 */
import { describe, expect, it } from 'vitest';
import { zoneFromRatio } from '../zone';

describe('zoneFromRatio — leaf (!canInside)', () => {
  it('верхняя половина → before', () => {
    expect(zoneFromRatio(0, false)).toBe('before');
    expect(zoneFromRatio(0.49, false)).toBe('before');
  });

  it('нижняя половина (>= 0.5) → after', () => {
    expect(zoneFromRatio(0.5, false)).toBe('after');
    expect(zoneFromRatio(1, false)).toBe('after');
  });

  it('пороги игнорируются для листа', () => {
    // thresholds не влияют на leaf-кейс — всегда сплит по 0.5.
    expect(zoneFromRatio(0.4, false, { before: 0.1, after: 0.9 })).toBe('before');
    expect(zoneFromRatio(0.6, false, { before: 0.1, after: 0.9 })).toBe('after');
  });
});

describe('zoneFromRatio — container (canInside)', () => {
  it('верхние 30% → before', () => {
    expect(zoneFromRatio(0, true)).toBe('before');
    expect(zoneFromRatio(0.29, true)).toBe('before');
  });

  it('нижние 30% → after', () => {
    expect(zoneFromRatio(0.71, true)).toBe('after');
    expect(zoneFromRatio(1, true)).toBe('after');
  });

  it('середина → inside', () => {
    expect(zoneFromRatio(0.3, true)).toBe('inside');
    expect(zoneFromRatio(0.5, true)).toBe('inside');
    expect(zoneFromRatio(0.7, true)).toBe('inside');
  });

  it('пороги переопределяются через thresholds', () => {
    expect(zoneFromRatio(0.15, true, { before: 0.1, after: 0.9 })).toBe('inside');
    expect(zoneFromRatio(0.05, true, { before: 0.1, after: 0.9 })).toBe('before');
    expect(zoneFromRatio(0.95, true, { before: 0.1, after: 0.9 })).toBe('after');
  });
});

import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import { mergeKitBundles } from '../bundle';
import { weberKit } from '../index';

describe('weberKit — kit-bundle контракт', () => {
  it('components/conventions/manifests на месте; kindTags только для существующих компонентов', () => {
    expect(weberKit.components.Button).toBeTypeOf('function');
    for (const name of Object.keys(weberKit.conventions?.kindTags ?? {})) {
      expect(weberKit.components[name], `kindTag «${name}» ссылается на компонент`).toBeDefined();
    }
  });

  it('каждый манифест валиден: type=ui.*, есть label/category; propsSchema парсит defaultProps', () => {
    for (const m of weberKit.manifests ?? []) {
      expect(m.type).toMatch(/^ui\./);
      expect(m.label).toBeTruthy();
      expect(m.category).toBeTruthy();
      if (m.propsSchema && m.defaultProps) {
        const schema = m.propsSchema as z.ZodTypeAny;
        expect(() => schema.parse(m.defaultProps)).not.toThrow();
      }
    }
  });
});

describe('mergeKitBundles — augmentation-модель (fork-flag #10 предка)', () => {
  it('боковой bundle мержится: компоненты, kindTags, manifests, passthrough-ключи', () => {
    const side = {
      components: { Matrix: () => null },
      conventions: { kindTags: { Matrix: 'layout' }, rawPassthroughKeys: ['Charts'] },
      manifests: [{ type: 'ui.Matrix', label: 'Matrix', category: 'container' as const }],
    };
    const merged = mergeKitBundles(weberKit, side);
    expect(merged.components.Button).toBeDefined();
    expect(merged.components.Matrix).toBeDefined();
    expect(merged.conventions?.kindTags?.Button).toBe('button');
    expect(merged.conventions?.kindTags?.Matrix).toBe('layout');
    expect(merged.conventions?.rawPassthroughKeys).toContain('Flow');
    expect(merged.conventions?.rawPassthroughKeys).toContain('Charts');
    expect(merged.manifests?.some((m) => m.type === 'ui.Matrix')).toBe(true);
  });

  it('коллизия компонентов: правый bundle выигрывает', () => {
    const override = { components: { Button: 'custom' } };
    const merged = mergeKitBundles(weberKit, override as never);
    expect(merged.components.Button).toBe('custom');
  });
});

import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createEntityWrapper } from '../entity';
import { createRegistry } from '../registry';

describe('registry — per-engine, без globalThis', () => {
  it('register мержит per-namespace, реестры инстансов независимы', () => {
    const a = createRegistry();
    const b = createRegistry({ Views: { Seed: 1 } });
    a.register({ Views: { X: 1 }, Widgets: { W: 2 } });
    a.register({ Views: { Y: 3 } });
    expect(Object.keys(a.registry.Views)).toEqual(['X', 'Y']);
    expect(a.registry.Widgets.W).toBe(2);
    expect(Object.keys(b.registry.Views)).toEqual(['Seed']);
    expect((globalThis as any).Views).toBeUndefined(); // ничего не течёт в globalThis
  });
});

describe('Entity — plain config, tools из сборки', () => {
  it('фабрика получает tools, результат заморожен', () => {
    const Entity = createEntityWrapper({ zod: z, custom: 'tool' });
    const Users = Entity(({ zod, custom }: any) => ({
      schema: zod.array(zod.object({ id: zod.string() })),
      defaults: [{ id: '1' }],
      seenTool: custom,
    }));
    expect(Users.seenTool).toBe('tool');
    expect(Users.schema.parse([{ id: 'a' }])).toEqual([{ id: 'a' }]);
    expect(Object.isFrozen(Users)).toBe(true);
    expect(() => {
      (Users as any).defaults = [];
    }).toThrow();
  });
});

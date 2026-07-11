import { describe, expect, it } from 'vitest';
import { defineModule } from '../module';

describe('defineModule', () => {
  it('returns the same descriptor (identity, no wrapping)', () => {
    const descriptor = {
      name: 'weber:noop' as const,
      create: () => ({ ping: () => 'pong' }),
    };
    expect(defineModule(descriptor)).toBe(descriptor);
  });

  it('create produces independent instances (per-engine, no module-global state)', () => {
    const counter = defineModule({
      name: 'weber:counter',
      create: (config?: { start?: number }) => {
        let n = config?.start ?? 0;
        return { inc: () => ++n, value: () => n };
      },
    });
    const a = counter.create({ start: 10 });
    const b = counter.create();
    a.inc();
    expect(a.value()).toBe(11);
    expect(b.value()).toBe(0);
  });
});

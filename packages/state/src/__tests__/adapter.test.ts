import { createRoot } from 'solid-js';
import { describe, expect, it } from 'vitest';
import { createSolidStateAdapter } from '../adapter';
import { runStateAdapterConformance } from '../conformance';

// Портовый conformance — обязательный для любого адаптера экосистемы.
runStateAdapterConformance('solid-native', () => createSolidStateAdapter());

// Адаптер-специфика поверх conformance.
describe('solid-native adapter — specifics', () => {
  it('инстансы независимы (никакого module-global state)', () => {
    createRoot((dispose) => {
      const adapter = createSolidStateAdapter();
      const schema = { initial: 'a', context: { n: 1 }, states: { a: {}, b: {} } };
      const one = adapter.create(structuredClone(schema));
      const two = adapter.create(structuredClone(schema));
      one.stateApi.set('b');
      one.store.update({ n: 42 });
      expect(two.stateApi.current).toBe('a');
      expect((two.store.ctx as any).n).toBe(1);
      dispose();
    });
  });

  it('snapshot совместим с формой предка ({ value, context })', () => {
    createRoot((dispose) => {
      const adapter = createSolidStateAdapter();
      const { stateApi, snapshot } = adapter.create({
        initial: 'a',
        states: { a: {}, b: {} },
      });
      expect((snapshot as any).value).toBe('a');
      stateApi.set('b');
      expect((snapshot as any).value).toBe('b');
      dispose();
    });
  });
});

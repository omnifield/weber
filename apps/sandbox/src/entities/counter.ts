// Слой БЕЗ импортов: Entity — глобал (unimport → src/engine.ts).
const Counter = Entity(({ zod }: any) => ({
  schema: zod.object({ count: zod.number() }),
  defaults: { count: 0 },
}));

export default Counter;

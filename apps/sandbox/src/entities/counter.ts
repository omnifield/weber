// Слой БЕЗ импортов: Entity — глобал (unimport → src/engine.ts).
// Канон: именованный экспорт = PascalCase имени файла (прозрачная навигация
// через registry-барели) + default.
export const Counter = Entity(({ zod }: any) => ({
  schema: zod.object({ count: zod.number() }),
  defaults: { count: 0 },
}));

export default Counter;

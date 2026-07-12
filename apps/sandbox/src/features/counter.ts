// Слой БЕЗ импортов: Feature + Entities — глобалы (engine + registry-барели).
export const Counter = Feature(() => ({
  initial: 'idle',
  context: { ...(Entities.Counter.defaults as object) },
  states: {
    idle: {
      onClick: ({ store, context }: any) => {
        store.update({ count: context.count + 1 });
      },
    },
  },
}));

export default Counter;

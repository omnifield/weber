// Слой БЕЗ импортов: View/useCtx — глобалы.
export const Counter = View((Ui: any) => {
  const ctx = useCtx<{ count: number }>();
  return (
    <section>
      <output data-testid="count">{String(ctx.store.ctx.count)}</output>
      <Ui.Button meta={{ tags: ['inc'] }}>+1</Ui.Button>
    </section>
  );
});

export default Counter;

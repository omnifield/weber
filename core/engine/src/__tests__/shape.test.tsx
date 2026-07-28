/* @vitest-environment jsdom */
import { createSolidStateAdapter } from '@omnifield/weber-state';
import { For } from 'solid-js';
import { render } from 'solid-js/web';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createWeberEngine } from '../engine';

// Стаб-шаблоны (роль ui.List / ui.DataTable китов).
const StubList = (props: any) => (
  <ul data-testid="list" data-variant={props.variant}>
    <For each={props.data ?? []}>
      {(row: any) => {
        const Item = props.item?.use;
        const itemProps = props.item?.props ? props.item.props(row) : {};
        return Item ? <Item {...itemProps} /> : <li>{JSON.stringify(row)}</li>;
      }}
    </For>
  </ul>
);
const StubLink = (props: any) => (
  <li data-testid="item" data-href={props.href}>
    {props.label}
  </li>
);
const StubTable = (props: any) => <table data-testid="table" data-rows={props.data?.length} />;

const KIT = { List: StubList, Link: StubLink, Table: StubTable };

const mkEngine = () =>
  createWeberEngine({ kit: KIT, adapter: createSolidStateAdapter(), tools: { zod: z } });

let container: HTMLDivElement;
let cleanup: () => void;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
});

afterEach(() => {
  cleanup?.();
  document.body.removeChild(container);
});

describe('Shape — two-phase (ADR 036 предка)', () => {
  it('bind.as tracker резолвится в компонент кита через ShapeUiContext (внутри View)', () => {
    const engine = mkEngine();
    const { Shape, View } = engine;

    const Nav = Shape(
      (ui: any, { zod }: any) => ({
        schema: zod.array(zod.object({ label: zod.string(), href: zod.string() })),
        as: ui.List,
        defaults: [
          { label: 'Home', href: '/' },
          { label: 'Docs', href: '/docs' },
        ],
      }),
      (ui: any) => ({
        item: { use: ui.Link, props: (it: any) => ({ label: it.label, href: it.href }) },
      }),
    );

    const Screen = View(() => <Nav />);
    cleanup = render(() => <Screen />, container);

    const items = container.querySelectorAll('[data-testid="item"]');
    expect(items).toHaveLength(2);
    expect(items[0].getAttribute('data-href')).toBe('/');
    expect(items[1].textContent).toBe('Docs');
  });

  it('consumer `as` и `data` перекрывают bind/config', () => {
    const engine = mkEngine();
    const { Shape, View } = engine;

    const Rows = Shape((ui: any) => ({
      as: ui.List,
      defaults: [{ a: 1 }],
    }));

    const Screen = View((Ui: any) => <Rows as={Ui.Table} data={[{ a: 1 }, { a: 2 }, { a: 3 }]} />);
    cleanup = render(() => <Screen />, container);

    const table = container.querySelector('[data-testid="table"]');
    expect(table).not.toBeNull();
    expect(table?.getAttribute('data-rows')).toBe('3');
    expect(container.querySelector('[data-testid="list"]')).toBeNull();
  });

  it('config-объект и config-функция мержатся в props шаблона (config поверх bind-extras)', () => {
    const engine = mkEngine();
    const { Shape, View } = engine;

    const A = Shape((ui: any) => ({ as: ui.List, variant: 'bind' }), { variant: 'config' });
    const ScreenA = View(() => <A />);
    cleanup = render(() => <ScreenA />, container);
    expect(container.querySelector('[data-testid="list"]')?.getAttribute('data-variant')).toBe(
      'config',
    );
    cleanup();
    cleanup = () => {};

    const B = Shape(
      (ui: any) => ({ as: ui.List }),
      (_ui: any, props: any) => ({ variant: props.tone }),
    );
    const ScreenB = View(() => <B tone="fn" />);
    cleanup = render(() => <ScreenB />, container);
    expect(container.querySelector('[data-testid="list"]')?.getAttribute('data-variant')).toBe(
      'fn',
    );
  });

  it('без шаблона (нет as нигде) рендерит null, без падения', () => {
    const engine = mkEngine();
    const { Shape, View } = engine;
    const Empty = Shape(() => ({ defaults: [] }));
    const Screen = View(() => <Empty />);
    cleanup = render(() => <Screen />, container);
    expect(container.querySelector('[data-testid="list"]')).toBeNull();
  });
});

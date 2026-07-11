/* @vitest-environment jsdom */
/**
 * СМОК ИТ.1 — «кор жив end-to-end»: мини-апп на собранном движке.
 * Полный цикл: Entity (zod из tools) → Feature (context из Entity.defaults,
 * хендлеры) → View (meta-кнопка из СТАБ-кита + реактивное значение из ctx) →
 * Widget (композиция) → клик → dispatch → store.update → ре-рендер.
 */
import { useCtx } from '@weber/kernel';
import { createSolidStateAdapter } from '@weber/state';
import { render } from 'solid-js/web';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { createWeberEngine } from '../engine';

const StubButton = (props: any) => (
  <button data-testid="btn" type="button" {...props}>
    {props.children}
  </button>
);
const StubCard = (props: any) => <section {...props}>{props.children}</section>;
const STUB_KIT = { Button: StubButton, Card: StubCard };

const mkEngine = (extra: Partial<Parameters<typeof createWeberEngine>[0]> = {}) =>
  createWeberEngine({
    kit: STUB_KIT,
    adapter: createSolidStateAdapter(),
    tools: { zod: z },
    ...extra,
  });

let container: HTMLDivElement;
let cleanup: () => void;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
});

afterEach(() => {
  cleanup?.();
  document.body.removeChild(container);
  vi.restoreAllMocks();
});

describe('engine e2e — мини-апп полного цикла', () => {
  it('Entity → Feature → View → Widget: клик диспатчит, store обновляется, UI ре-рендерится', async () => {
    const engine = mkEngine();
    const { Entity, Feature, View, Widget } = engine;

    // --- Entity: домен + дефолты (zod пришёл из tools сборки) ---
    const Counter = Entity(({ zod }: any) => ({
      schema: zod.object({ count: zod.number() }),
      defaults: { count: 0 },
    }));
    expect(Counter.schema.parse({ count: 1 })).toEqual({ count: 1 });

    // --- Feature: context из Entity, хендлер инкремента ---
    const CounterFeature = Feature(() => ({
      initial: 'idle',
      context: { ...(Counter.defaults as object) },
      states: {
        idle: {
          onClick: ({ store, context }: any) => {
            store.update({ count: (context as any).count + 1 });
          },
        },
      },
    }));

    // --- View: meta-кнопка + реактивное значение из ctx ---
    const CounterView = View((Ui: any) => {
      const ctx = useCtx<{ count: number }>();
      return (
        <Ui.Card>
          <output data-testid="count">{String((ctx.store.ctx as any).count)}</output>
          <Ui.Button meta={{ tags: ['inc'] }}>+1</Ui.Button>
        </Ui.Card>
      );
    });

    // --- Widget: композиция Feature + View ---
    const CounterWidget = Widget(() => (
      <CounterFeature>
        <CounterView />
      </CounterFeature>
    ));

    cleanup = render(() => <CounterWidget />, container);

    const count = () => container.querySelector('[data-testid="count"]')?.textContent;
    expect(count()).toBe('0');

    const btn = container.querySelector('[data-testid="btn"]') as HTMLButtonElement;
    btn.click();
    await Promise.resolve(); // async dispatch (ControllerProxy handlers асинхронны)
    expect(count()).toBe('1');
    btn.click();
    await Promise.resolve();
    expect(count()).toBe('2');
  });

  it('два движка на странице полностью изолированы (реестры и стейт)', async () => {
    const a = mkEngine();
    const b = mkEngine();
    a.register({ Views: { Hello: () => null } });
    expect(Object.keys(a.registry.Views)).toEqual(['Hello']);
    expect(Object.keys(b.registry.Views)).toEqual([]);
  });

  it('Widget loader-swap: контент не инстанцируется, пока store.loading=true', async () => {
    const engine = mkEngine();
    const { Feature, Widget, View } = engine;
    const contentSpy = vi.fn();

    const LoadingFeature = Feature(() => ({
      initial: 'idle',
      states: {
        idle: {
          onGo: ({ store }: any) => store.setLoading(false),
        },
      },
    }));

    const ContentView = View(() => {
      contentSpy();
      return <p data-testid="content">ready</p>;
    });

    const W = Widget((_Ui, _store, _props) => <ContentView />, {
      loader: () => <p data-testid="loader">loading…</p>,
    });

    // loading ставим ДО монтирования виджета (эффектный onInit фаерит после
    // первого рендера — timing-семантика предка та же): Probe выставляет
    // loading синхронно в render-фазе, до рендера соседнего <W/> ниже.
    let emitRef: any;
    const Probe = () => {
      const ctx = useCtx();
      ctx.store.setLoading(true);
      emitRef = () => (ctx.controller as any).onGo({}, ctx.store.ctx);
      return null;
    };

    cleanup = render(
      () => (
        <LoadingFeature>
          <Probe />
          <W />
        </LoadingFeature>
      ),
      container,
    );

    expect(container.querySelector('[data-testid="loader"]')).not.toBeNull();
    expect(contentSpy).not.toHaveBeenCalled();

    await emitRef();
    expect(container.querySelector('[data-testid="content"]')).not.toBeNull();
    expect(contentSpy).toHaveBeenCalledOnce();
  });

  it('trace-слот покрывает слои сборки (view mount/dispose)', () => {
    const trace = vi.fn();
    const engine = mkEngine({ trace });
    const V = engine.View(() => <p>x</p>);
    const dispose = render(() => <V />, container);
    dispose();
    cleanup = () => {};
    const nodes = trace.mock.calls.map((c) => `${c[0]}:${c[1]}`);
    expect(nodes).toContain('weber.view:mount');
    expect(nodes).toContain('weber.view:dispose');
  });
});

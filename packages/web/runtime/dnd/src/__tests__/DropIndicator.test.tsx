/**
 * Smoke tests for <DropIndicator> — renders the correct markup per zone.
 *
 * Стиль инлайновый (не Tailwind), поэтому проверяем структуру DOM:
 *  - before/after → сепаратор = flex-контейнер с 2 span'ами (точка + линия);
 *  - inside       → одиночный div с ring/fill (box-shadow inset);
 *  - null         → ничего не рендерится.
 */
/* @vitest-environment jsdom */
import { render } from 'solid-js/web';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DropIndicator } from '../DropIndicator';

let container: HTMLDivElement;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
});

afterEach(() => {
  if (container.parentNode) document.body.removeChild(container);
});

describe('<DropIndicator>', () => {
  it('zone="before" → сепаратор (2 span: точка + линия)', () => {
    const dispose = render(() => <DropIndicator zone="before" />, container);
    const spans = container.querySelectorAll('span');
    expect(spans.length).toBe(2);
    // straddle верхнего края
    const wrapper = container.querySelector('div');
    expect(wrapper?.style.top).toBe('0px');
    expect(wrapper?.style.transform).toContain('translateY(-50%)');
    dispose();
  });

  it('zone="after" → сепаратор у нижнего края', () => {
    const dispose = render(() => <DropIndicator zone="after" />, container);
    const spans = container.querySelectorAll('span');
    expect(spans.length).toBe(2);
    const wrapper = container.querySelector('div');
    expect(wrapper?.style.bottom).toBe('0px');
    expect(wrapper?.style.transform).toContain('translateY(50%)');
    dispose();
  });

  it('zone="inside" → кольцо + заливка (div с box-shadow inset, без span)', () => {
    const dispose = render(() => <DropIndicator zone="inside" />, container);
    expect(container.querySelectorAll('span').length).toBe(0);
    const box = container.querySelector('div');
    expect(box).not.toBeNull();
    expect(box?.style.boxShadow).toContain('inset');
    dispose();
  });

  it('zone=null → ничего не рендерится', () => {
    const dispose = render(() => <DropIndicator zone={null} />, container);
    expect(container.querySelector('div')).toBeNull();
    expect(container.querySelector('span')).toBeNull();
    dispose();
  });
});

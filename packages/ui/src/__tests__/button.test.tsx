/* @vitest-environment jsdom */
import { render } from 'solid-js/web';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Button } from '../primitives/button';

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

const btn = () => container.querySelector('[data-slot="button"]') as HTMLButtonElement;

describe('Button — эталон-примитив кита', () => {
  it('дефолт: <button type="button">, data-variant/data-size default', () => {
    cleanup = render(() => <Button>Go</Button>, container);
    expect(btn().tagName).toBe('BUTTON');
    expect(btn().getAttribute('type')).toBe('button');
    expect(btn().getAttribute('data-variant')).toBe('default');
    expect(btn().getAttribute('data-size')).toBe('default');
    expect(btn().textContent).toBe('Go');
  });

  it('варианты попадают в класс и data-атрибуты (только токен-классы)', () => {
    cleanup = render(
      () => (
        <Button variant="destructive" size="lg">
          Del
        </Button>
      ),
      container,
    );
    expect(btn().getAttribute('data-variant')).toBe('destructive');
    expect(btn().className).toContain('bg-destructive');
    expect(btn().className).toContain('h-10');
  });

  it('полиморфизм: as="a" рендерит <a> БЕЗ type-атрибута', () => {
    cleanup = render(
      () => (
        <Button as="a" href="/x">
          Link
        </Button>
      ),
      container,
    );
    const a = container.querySelector('[data-slot="button"]') as HTMLAnchorElement;
    expect(a.tagName).toBe('A');
    expect(a.getAttribute('href')).toBe('/x');
    expect(a.hasAttribute('type')).toBe(false);
  });

  it('loading: спиннер вместо children, disabled + aria-busy/data-busy', () => {
    cleanup = render(() => <Button loading>Save</Button>, container);
    expect(btn().disabled).toBe(true);
    expect(btn().getAttribute('aria-busy')).toBe('true');
    expect(btn().hasAttribute('data-busy')).toBe(true);
    expect(btn().textContent).not.toContain('Save');
    expect(btn().querySelector('[data-slot="spinner"]')).not.toBeNull();
  });

  it('fullWidth добавляет w-full; user-class мержится', () => {
    cleanup = render(
      () => (
        <Button fullWidth class="my-extra">
          W
        </Button>
      ),
      container,
    );
    expect(btn().className).toContain('w-full');
    expect(btn().className).toContain('my-extra');
  });

  it('onClick живой (полиморфная база не глотает события)', () => {
    let clicks = 0;
    cleanup = render(() => <Button onClick={() => clicks++}>C</Button>, container);
    btn().click();
    expect(clicks).toBe(1);
  });
});

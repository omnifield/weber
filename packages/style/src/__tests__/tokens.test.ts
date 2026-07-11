import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DARK,
  DEFAULT_LIGHT,
  PALETTE_TOKENS,
  THEME_META_TOKENS,
  themeToCss,
} from '../tokens';

/** Парс CSS-блока в карту токенов: `selector { --k: v; }` → { k: v }. */
const parseBlock = (css: string, selector: string): Record<string, string> => {
  const start = css.indexOf(`${selector} {`);
  expect(start, `селектор «${selector}» найден в themes.css`).toBeGreaterThanOrEqual(0);
  const end = css.indexOf('}', start);
  const body = css.slice(start + selector.length + 2, end);
  const out: Record<string, string> = {};
  for (const line of body.split(';')) {
    const m = line.match(/--([\w-]+):\s*([\s\S]+)/);
    if (m) out[m[1]] = m[2].trim().replace(/\s+/g, ' ');
  }
  return out;
};

const norm = (tokens: Record<string, string>): Record<string, string> =>
  Object.fromEntries(Object.entries(tokens).map(([k, v]) => [k, v.replace(/\s+/g, ' ')]));

describe('токен-канон (ADR 042: set frozen)', () => {
  it('обе дефолт-темы покрывают ПОЛНОЕ цветовое ядро контракта', () => {
    for (const token of PALETTE_TOKENS) {
      expect(DEFAULT_LIGHT[token], `light: --${token}`).toBeTruthy();
      expect(DEFAULT_DARK[token], `dark: --${token}`).toBeTruthy();
    }
  });

  it('дефолт-темы не содержат токенов ВНЕ контракта', () => {
    const known = new Set<string>([...PALETTE_TOKENS, ...THEME_META_TOKENS]);
    for (const key of Object.keys(DEFAULT_LIGHT)) {
      expect(known.has(key), `--${key} объявлен в контракте`).toBe(true);
    }
  });

  it('themes.css синхронен с TS-контрактом токен-в-токен (:root=light, .dark=dark)', () => {
    const css = readFileSync(join(__dirname, '../css/themes.css'), 'utf8');
    expect(parseBlock(css, ':root')).toEqual(norm(DEFAULT_LIGHT));
    expect(parseBlock(css, '.dark')).toEqual(norm(DEFAULT_DARK));
  });

  it('base.css мапит каждый цветовой токен в tailwind-алиас', () => {
    const css = readFileSync(join(__dirname, '../css/base.css'), 'utf8');
    for (const token of PALETTE_TOKENS) {
      expect(css, `--color-${token}`).toContain(`--color-${token}: var(--${token})`);
    }
  });
});

describe('themeToCss', () => {
  it('сериализует тему в CSS-блок', () => {
    const css = themeToCss('[data-theme="x"]', { background: 'red' } as never);
    expect(css).toBe('[data-theme="x"] {\n  --background: red;\n}');
  });
});

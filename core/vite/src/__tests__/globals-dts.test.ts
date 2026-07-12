import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { generateGlobalsDts, writeRegistry } from '../registry';

let appRoot: string;

const seed = (rel: string, content = 'export default {};\n') => {
  const abs = join(appRoot, rel);
  mkdirSync(join(abs, '..'), { recursive: true });
  writeFileSync(abs, content, 'utf8');
};

beforeEach(() => {
  appRoot = mkdtempSync(join(tmpdir(), 'weber-globals-'));
});

afterEach(() => {
  rmSync(appRoot, { recursive: true, force: true });
});

describe('generateGlobalsDts — типы глобалов ПРЯМЫМИ typeof import (WebStorm-навигация)', () => {
  it('leaf типизирован импортом ИСТОЧНИКА (named при каноне, default fallback), nested по папкам', () => {
    seed('src/views/counter.tsx', 'export const Counter = 1;\nexport default Counter;\n');
    seed('src/views/viewer/login-form.tsx'); // только default
    const dts = generateGlobalsDts(appRoot);

    expect(dts).toContain("readonly Counter: (typeof import('../src/views/counter'))['Counter'];");
    expect(dts).toContain(
      "readonly LoginForm: (typeof import('../src/views/viewer/login-form'))['default'];",
    );
    expect(dts).toContain('readonly Viewer: {');
    // пустые слои — Record<string, never>
    expect(dts).toContain('const Widgets: Record<string, never>;');
    // обёртки и хуки — из engine-алиаса и пакетов кора
    expect(dts).toContain("const View: (typeof import('@weber-app/engine'))['View'];");
    expect(dts).toContain("const useCtx: (typeof import('@weber/kernel'))['useCtx'];");
    expect(dts).toContain('declare global {');
  });

  it('writeRegistry пишет globals.d.ts рядом с реестром', () => {
    seed('src/views/hello.tsx');
    writeRegistry(appRoot);
    const dts = readFileSync(join(appRoot, '.weber', 'globals.d.ts'), 'utf8');
    expect(dts).toContain('const Views: {');
  });
});

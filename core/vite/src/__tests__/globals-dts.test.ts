import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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

describe('generateGlobalsDts — слои typeof import однослойного registry-бареля (раунд-4)', () => {
  it('present-слой типизирован барелем, пустой — Record<string, never>, без sourceMappingURL', () => {
    seed('src/views/counter.tsx', 'export const Counter = 1;\nexport default Counter;\n');
    seed('src/views/viewer/login-form.tsx'); // nested — форма слоя не меняется
    const dts = generateGlobalsDts(appRoot);

    // Декларация leaf'а НЕ в d.ts: GTD уходит в барель (named re-export → источник).
    expect(dts).toContain("const Views: typeof import('./registry/views');");
    expect(dts).not.toContain('readonly Counter:');
    // пустые слои — Record<string, never>
    expect(dts).toContain('const Widgets: Record<string, never>;');
    // обёртки и хуки — из engine-алиаса и пакетов кора
    expect(dts).toContain("const View: (typeof import('@weber-app/engine'))['View'];");
    expect(dts).toContain("const useCtx: (typeof import('@weber/kernel'))['useCtx'];");
    expect(dts).toContain('declare global {');
    // раунд-3 (declaration map) откачен
    expect(dts).not.toContain('sourceMappingURL');
  });

  it('writeRegistry пишет globals.d.ts и стирает stale globals.d.ts.map раунда-3', () => {
    seed('src/views/hello.tsx');
    const staleMap = join(appRoot, '.weber', 'globals.d.ts.map');
    mkdirSync(join(appRoot, '.weber'), { recursive: true });
    writeFileSync(staleMap, '{"version":3}', 'utf8');

    writeRegistry(appRoot);

    const dts = readFileSync(join(appRoot, '.weber', 'globals.d.ts'), 'utf8');
    expect(dts).toContain("const Views: typeof import('./registry/views');");
    expect(existsSync(staleMap)).toBe(false);
  });
});

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { toPascal } from '../naming';
import { generateRegistryFiles, writeRegistry } from '../registry';

let appRoot: string;

const seed = (rel: string, content = 'export default {};\n') => {
  const abs = join(appRoot, rel);
  mkdirSync(join(abs, '..'), { recursive: true });
  writeFileSync(abs, content, 'utf8');
};

beforeEach(() => {
  appRoot = mkdtempSync(join(tmpdir(), 'weber-registry-'));
});

afterEach(() => {
  rmSync(appRoot, { recursive: true, force: true });
});

describe('toPascal', () => {
  it('kebab/snake/файл-расширение → PascalCase', () => {
    expect(toPascal('login-form.tsx')).toBe('LoginForm');
    expect(toPascal('user_card')).toBe('UserCard');
    expect(toPascal('hello.ts')).toBe('Hello');
    expect(toPascal('viewer')).toBe('Viewer');
  });
});

describe('generateRegistryFiles — barrel-кодген', () => {
  it('nested по папкам: leaf re-export + mid-барели + корневой index с registry-объектом', () => {
    // канон-файл: именованный экспорт = PascalCase имени файла → ИМЕНОВАННЫЙ
    // ре-экспорт (прозрачная навигация); без именованного — default-алиас.
    seed('src/views/hello.tsx', 'export const Hello = 1;\nexport default Hello;\n');
    seed('src/views/viewer/login-form.tsx');
    seed('src/widgets/forms/auth.tsx', 'export const Auth = 1;\nexport default Auth;\n');

    const files = generateRegistryFiles(appRoot);

    const viewsIndex = files.get('views/index.ts') ?? '';
    expect(viewsIndex).toContain("export * as Viewer from './viewer';");
    expect(viewsIndex).toContain("export { Hello } from '../../../src/views/hello';");

    const viewerIndex = files.get('views/viewer/index.ts') ?? '';
    // fallback: файл только с default → default-алиас
    expect(viewerIndex).toContain(
      "export { default as LoginForm } from '../../../../src/views/viewer/login-form';",
    );
    const widgetsForms = files.get('widgets/forms/index.ts') ?? '';
    expect(widgetsForms).toContain('export { Auth } from');

    const root = files.get('index.ts') ?? '';
    expect(root).toContain("export * as Views from './views';");
    expect(root).toContain("export * as Widgets from './widgets';");
    expect(root).toContain('export const registry = {');
    // пустые слои — {} (тотальность для engine.register)
    expect(root).toContain('Entities: {},');
    expect(root).toContain('Shapes: {},');
    expect(root).toContain('Views,');
  });

  it('игнорирует d.ts и тест-файлы; пустой src → все слои пустые', () => {
    seed('src/views/types.d.ts');
    seed('src/views/hello.test.tsx');
    const files = generateRegistryFiles(appRoot);
    const root = files.get('index.ts') ?? '';
    expect(root).toContain('Views: {},');
    expect(files.has('views/index.ts')).toBe(false);
  });
});

describe('writeRegistry — запись на диск', () => {
  it('пишет файлы; повторный прогон без изменений — ноль перезаписей (стабильные d.ts/watch)', () => {
    seed('src/views/hello.tsx');
    const first = writeRegistry(appRoot);
    expect(first.length).toBeGreaterThan(0);
    const second = writeRegistry(appRoot);
    expect(second).toHaveLength(0);
  });

  it('добавление файла слоя меняет барель (механика watch-регенерации)', () => {
    seed('src/views/hello.tsx');
    writeRegistry(appRoot);
    seed('src/views/bye.tsx');
    const written = writeRegistry(appRoot);
    expect(written.some((f) => f.endsWith('index.ts'))).toBe(true);
  });
});

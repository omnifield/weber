import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildSourceMap, encodeVlq, findDeclPosition } from '../declaration-map';
import { generateGlobalsArtifacts } from '../registry';

describe('encodeVlq', () => {
  it('канонические значения спеки', () => {
    expect(encodeVlq(0)).toBe('A');
    expect(encodeVlq(1)).toBe('C');
    expect(encodeVlq(-1)).toBe('D');
    expect(encodeVlq(16)).toBe('gB');
  });
});

describe('findDeclPosition', () => {
  it('находит строку/колонку export const', () => {
    const src = `// шапка\nимпорт-нет\nexport const Counter = View(() => null);\n`;
    expect(findDeclPosition(src, 'Counter')).toEqual({ line: 2, column: 13 });
  });
  it('фолбэк 0:0 без декларации', () => {
    expect(findDeclPosition('export default {};', 'Counter')).toEqual({ line: 0, column: 0 });
  });
});

describe('buildSourceMap', () => {
  it('строки без маппинга — пустые; сегмент содержит genCol/src/line/col', () => {
    const map = JSON.parse(
      buildSourceMap(
        'globals.d.ts',
        [
          {
            generatedLine: 2,
            generatedColumn: 4,
            source: '../src/views/counter.tsx',
            sourceLine: 2,
            sourceColumn: 13,
          },
        ],
        4,
      ),
    );
    expect(map.version).toBe(3);
    expect(map.sources).toEqual(['../src/views/counter.tsx']);
    const lines = (map.mappings as string).split(';');
    expect(lines).toHaveLength(4);
    expect(lines[0]).toBe('');
    expect(lines[2]).toBe('IAEa'); // [4,0,2,13] в VLQ
  });
});

describe('generateGlobalsArtifacts — d.ts + declaration map', () => {
  let appRoot: string;
  beforeEach(() => {
    appRoot = mkdtempSync(join(tmpdir(), 'weber-declmap-'));
  });
  afterEach(() => {
    rmSync(appRoot, { recursive: true, force: true });
  });

  it('маппинг каждого leaf ведёт в позицию export const источника; d.ts ссылается на карту', () => {
    const dir = join(appRoot, 'src/views');
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, 'counter.tsx'),
      `// комментарий\nexport const Counter = 1;\nexport default Counter;\n`,
      'utf8',
    );

    const { dts, map } = generateGlobalsArtifacts(appRoot);
    expect(dts).toContain('//# sourceMappingURL=globals.d.ts.map');

    const parsed = JSON.parse(map);
    expect(parsed.sources).toContain('../src/views/counter.tsx');

    // строка декларации Counter в d.ts замаплена (не пустая в mappings)
    const dtsLines = dts.split('\n');
    const declLine = dtsLines.findIndex((l) => l.includes('readonly Counter:'));
    const mappingLines = (parsed.mappings as string).split(';');
    expect(mappingLines[declLine]).not.toBe('');
  });
});

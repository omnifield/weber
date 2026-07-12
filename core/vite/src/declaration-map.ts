/**
 * Source map V3 для генерённого d.ts (declaration map): IDE редиректит
 * Go-to-Definition из декларации глобала ПРЯМО в исходник — так навигация
 * работает у библиотек с declarationMap. Минимальный самописный энкодер
 * (одна зависимость ради VLQ не в кассу): по одному сегменту на замапленную
 * строку [genCol, srcIdx, srcLine, srcCol].
 */

const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Base64-VLQ (спека source map v3): знаковое → continuation-биты по 5. */
export const encodeVlq = (value: number): string => {
  let vlq = value < 0 ? (-value << 1) | 1 : value << 1;
  let out = '';
  do {
    let digit = vlq & 0b11111;
    vlq >>>= 5;
    if (vlq > 0) digit |= 0b100000;
    out += BASE64[digit];
  } while (vlq > 0);
  return out;
};

export interface IDtsMapping {
  /** 0-based строка в генерённом d.ts. */
  generatedLine: number;
  /** 0-based колонка (позиция имени свойства). */
  generatedColumn: number;
  /** Путь источника (как попадёт в sources). */
  source: string;
  /** 0-based строка/колонка декларации в источнике. */
  sourceLine: number;
  sourceColumn: number;
}

/** Собирает source map v3 из точечных маппингов (по одному на строку). */
export const buildSourceMap = (
  file: string,
  mappings: IDtsMapping[],
  totalLines: number,
): string => {
  const sources: string[] = [];
  const sourceIndex = new Map<string, number>();
  for (const m of mappings) {
    if (!sourceIndex.has(m.source)) {
      sourceIndex.set(m.source, sources.length);
      sources.push(m.source);
    }
  }

  const byLine = new Map<number, IDtsMapping>();
  for (const m of mappings) byLine.set(m.generatedLine, m);

  let prevSrcIdx = 0;
  let prevSrcLine = 0;
  let prevSrcCol = 0;
  const lines: string[] = [];
  for (let line = 0; line < totalLines; line++) {
    const m = byLine.get(line);
    if (!m) {
      lines.push('');
      continue;
    }
    const idx = sourceIndex.get(m.source) as number;
    const segment =
      encodeVlq(m.generatedColumn) +
      encodeVlq(idx - prevSrcIdx) +
      encodeVlq(m.sourceLine - prevSrcLine) +
      encodeVlq(m.sourceColumn - prevSrcCol);
    prevSrcIdx = idx;
    prevSrcLine = m.sourceLine;
    prevSrcCol = m.sourceColumn;
    lines.push(segment);
  }

  return JSON.stringify({
    version: 3,
    file,
    sourceRoot: '',
    sources,
    names: [],
    mappings: lines.join(';'),
  });
};

/** Позиция (0-based line/col) декларации `name` в источнике; фолбэк 0:0. */
export const findDeclPosition = (
  source: string,
  name: string,
): { line: number; column: number } => {
  const patterns = [
    new RegExp(`export\\s+(?:const|let|var|function|class)\\s+(${name})\\b`),
    new RegExp(`(?:^|\\n)\\s*(?:const|let|var|function|class)\\s+(${name})\\b`),
    new RegExp(`export\\s+default\\s+(${name})\\b`),
  ];
  for (const re of patterns) {
    const match = re.exec(source);
    if (match) {
      const nameOffset = match.index + match[0].lastIndexOf(name);
      const before = source.slice(0, nameOffset);
      const line = before.split('\n').length - 1;
      const column = nameOffset - (before.lastIndexOf('\n') + 1);
      return { line, column };
    }
  }
  return { line: 0, column: 0 };
};

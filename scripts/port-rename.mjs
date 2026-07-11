#!/usr/bin/env node
// port-rename.mjs — codemod бренд-ренейма при переносе пакета из оракула (CC-1 аудита:
// «скриптом, не руками по файлу»). Базовая карта + пер-пакетные пары аргументами.
//
//   node scripts/port-rename.mjs packages/lib-builder [From:To ...]
//
// Проходит все текстовые файлы пакета (кроме node_modules/dist/out-tsc), применяет замены,
// в конце печатает residual-строки с "capsule" (регистронезависимо) — они требуют ручного
// решения (проза/конвенции), молча не пропускаются.

import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { argv, exit } from 'node:process';

const BASE_MAP = [
  ['@capsuletech/', '@weber/'],
  ['@capsuletech\\/', '@weber\\/'], // regex-литералы (external-матчеры и т.п.)
  ['capsule:', 'weber:'], // префикс vite-плагинов (напр. capsule:emit-dist-package-json)
];

const TEXT_EXT = new Set([
  '.ts',
  '.tsx',
  '.mts',
  '.cts',
  '.js',
  '.mjs',
  '.json',
  '.md',
  '.css',
  '.html',
  '.yml',
  '.yaml',
]);
const SKIP_DIRS = new Set(['node_modules', 'dist', 'out-tsc', '.nx', 'coverage']);

const dir = argv[2];
if (!dir) {
  console.error('usage: node scripts/port-rename.mjs <package-dir> [From:To ...]');
  exit(1);
}
const extra = argv.slice(3).map((pair) => {
  const i = pair.indexOf(':');
  return [pair.slice(0, i), pair.slice(i + 1)];
});
const map = [...BASE_MAP, ...extra];

const files = [];
(function walk(d) {
  for (const name of readdirSync(d)) {
    const full = join(d, name);
    if (statSync(full).isDirectory()) {
      if (!SKIP_DIRS.has(name)) walk(full);
    } else if (TEXT_EXT.has(extname(name))) {
      files.push(full);
    }
  }
})(dir);

let changed = 0;
for (const f of files) {
  const before = readFileSync(f, 'utf8');
  let after = before;
  for (const [from, to] of map) after = after.split(from).join(to);
  if (after !== before) {
    writeFileSync(f, after);
    changed++;
  }
}
console.log(
  `renamed: ${changed}/${files.length} files (map: ${map.map(([a, b]) => `${a}→${b}`).join(', ')})`,
);

// Residual-скан: всё, что осталось с "capsule", — на ручное решение.
let residual = 0;
for (const f of files) {
  const lines = readFileSync(f, 'utf8').split('\n');
  lines.forEach((line, i) => {
    if (/capsule/i.test(line)) {
      console.log(`RESIDUAL ${f}:${i + 1}: ${line.trim().slice(0, 120)}`);
      residual++;
    }
  });
}
console.log(
  residual ? `⚠️ residual: ${residual} строк — реши руками (проза/конвенции)` : '✅ residual: 0',
);

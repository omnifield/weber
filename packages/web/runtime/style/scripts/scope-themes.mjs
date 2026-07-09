#!/usr/bin/env node
// Перепаковывает каждую тему в themes/*.css так, чтобы её :root и .dark
// были скоупом для [data-theme="<name>"]. Идемпотентен: уже scoped файлы
// пропускает. Всё прочее в файле (@import, @custom-variant, @theme inline,
// @layer base) сохраняется как есть — мы только переписываем два селектора.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'themes');
const files = readdirSync(dir).filter((f) => f.endsWith('.css') && f !== 'index.css');

for (const file of files) {
  const name = basename(file, '.css');
  const path = join(dir, file);
  const src = readFileSync(path, 'utf8');
  if (src.includes(`[data-theme="${name}"]`)) {
    console.log(`skip ${file} (already scoped)`);
    continue;
  }
  const out = src
    .replace(/^:root(\s*\{)/m, `[data-theme="${name}"]$1`)
    .replace(/^\.dark(\s*\{)/m, `[data-theme="${name}"].dark,\n[data-theme="${name}"] .dark$1`);
  writeFileSync(path, out);
  console.log(`scoped ${file}`);
}

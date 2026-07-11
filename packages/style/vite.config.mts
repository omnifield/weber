import { copyFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { libConfig } from '@weber/lib-builder';

export default libConfig({
  entry: 'src/index.ts',
  name: 'WeberStyle',
  runtime: 'browser',
  plugins: [
    {
      name: 'weber:copy-css',
      apply: 'build',
      closeBundle() {
        // CSS-артефакты отдаются subpath'ами как есть (не через JS-граф).
        mkdirSync(resolve('dist/css'), { recursive: true });
        copyFileSync(resolve('src/css/base.css'), resolve('dist/css/base.css'));
        copyFileSync(resolve('src/css/themes.css'), resolve('dist/css/themes.css'));
      },
    },
  ],
});

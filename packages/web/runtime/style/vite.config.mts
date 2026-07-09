import { copyFileSync, mkdirSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { libConfig } from '@omnifield/lib-builder';

export default libConfig({
  entry: {
    index: 'src/index.ts',
  },
  name: 'OmnifieldStyle',
  plugins: [
    {
      name: 'copy-css',
      closeBundle() {
        copyFileSync(resolve('src/index.css'), resolve('dist/index.css'));

        const themesSrc = resolve('src/themes');
        const themesDst = resolve('dist/themes');
        mkdirSync(themesDst, { recursive: true });
        for (const file of readdirSync(themesSrc)) {
          if (file.endsWith('.css')) {
            copyFileSync(resolve(themesSrc, file), resolve(themesDst, file));
          }
        }
      },
    },
  ],
});

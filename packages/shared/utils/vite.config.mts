import { libConfig } from '@omnifield/lib-builder';

export default libConfig({
  entry: 'src/index.ts',
  name: 'OmnifieldUtils',
  // es-toolkit входит в NODE_EXTERNAL списке lib-builder'а — принудительно
  // включаем в bundle, чтобы app-консьюмер не требовал es-toolkit отдельно.
  bundleDependencies: ['es-toolkit'],
});

import { libConfig } from '@omnifield/lib-builder';

export default libConfig({
  entry: {
    index: 'src/index.ts',
    gen: 'src/gen/index.ts',
  },
  name: 'OmnifieldZod',
  // @faker-js/faker тяжёлый — бандлим только в gen-entry, основной index его не импортирует.
  // Явно включаем faker в bundle (bundleDependencies) — он не в BROWSER_EXTERNAL libConfig'а,
  // но задаём явно для документации намерения.
  bundleDependencies: ['@faker-js/faker'],
});

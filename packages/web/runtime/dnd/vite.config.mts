import { libConfig } from '@omnifield/lib-builder';

export default libConfig({
  entry: {
    index: 'src/index.ts',
    controllers: 'src/controllers/index.ts',
  },
  name: 'OmnifieldDnd',
});

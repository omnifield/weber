import { libConfig } from '@omnifield/lib-builder';

export default libConfig({
  entry: {
    index: 'src/index.ts',
    stream: 'src/stream/index.ts',
  },
  name: 'OmnifieldQuery',
});

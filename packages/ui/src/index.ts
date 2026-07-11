import type { IKitBundle } from './bundle';
import { Button, ButtonManifest } from './primitives/button';
import { Slot } from './primitives/slot';
import { Spinner } from './primitives/spinner';

export type { IKitBundle, IKitConventions } from './bundle';
export { mergeKitBundles } from './bundle';
export type { ComponentCategory, IComponentManifest } from './manifest/types';
export type { ButtonVariants, IButtonProps } from './primitives/button';
export { Button, ButtonManifest } from './primitives/button';
export type { ISlotProps } from './primitives/slot';
export { Slot } from './primitives/slot';
export type { ISpinnerProps } from './primitives/spinner';
export { Spinner } from './primitives/spinner';

/**
 * Kit-bundle этого кита — скармливается сборке
 * (`createWeberEngine({ kit: weberKit.components, uiProxy: … })` либо через
 * merge с другими bundle'ами: `mergeKitBundles(weberKit, sideKit)`).
 * Растёт по мере порта примитивов (бриф kit-primitives-port).
 */
export const weberKit: IKitBundle = {
  components: {
    Button,
    Spinner,
    Slot,
  },
  conventions: {
    kindTags: {
      Button: 'button',
      // Input/Textarea/Select/Checkbox — добавляются с портом соответствующих примитивов.
    },
    rawPassthroughKeys: ['Flow', 'Icons'],
  },
  manifests: [ButtonManifest],
};

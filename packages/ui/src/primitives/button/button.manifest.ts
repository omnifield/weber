import { z } from 'zod';
import type { IComponentManifest } from '../../manifest/types';
import { variants } from './variants';

/**
 * Манифест Button (эталон формы для остальных примитивов): живёт рядом с
 * компонентом, propsSchema выводится из variants (единый источник правды).
 * Contract-слой предка (web-contract) — embed/validation-волна.
 */
export const ButtonManifest: IComponentManifest = {
  type: 'ui.Button',
  label: 'Button',
  category: 'control',
  description: 'Кнопка с вариантами оформления',
  isLeaf: true,
  defaultProps: {
    variant: 'default',
    children: 'Button',
  },
  propsSchema: z.object({
    variant: z.enum(Object.keys(variants.variant) as [string, ...string[]]).default('default'),
    size: z.enum(Object.keys(variants.size) as [string, ...string[]]).default('default'),
    loading: z.boolean().optional(),
    disabled: z.boolean().optional(),
    fullWidth: z.boolean().optional(),
    children: z.string().default('Button'),
    class: z.string().optional(),
  }),
};

import type { VariantProps } from '@weber/style';
import type { JSX } from 'solid-js';
import type { spinnerCva } from './variants';

export type SpinnerVariants = VariantProps<typeof spinnerCva>;

export interface ISpinnerProps extends SpinnerVariants {
  class?: string;
  style?: JSX.CSSProperties | string;
  /** Accessible label для screen reader'ов. Дефолт — 'Loading'. */
  label?: string;
}

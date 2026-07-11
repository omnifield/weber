import type { VariantProps } from '@weber/style';
import type { JSX, ValidComponent } from 'solid-js';
import type { ISlotProps } from '../slot';
import type { buttonCva } from './variants';

export type ButtonVariants = VariantProps<typeof buttonCva>;

/**
 * Специфичные пропсы Button. `class`/`style`/`disabled`/`children`
 * задекларированы явно — splitProps на полиморфном дженерике иначе
 * не типизируется (грабля предка, сохранена).
 */
export interface IButtonOwnProps extends ButtonVariants {
  class?: string;
  style?: JSX.CSSProperties | string;
  /** true → children заменяются спиннером, кнопка disabled. */
  loading?: boolean;
  disabled?: boolean;
  children?: JSX.Element;
  /** true → w-full (кнопка тянется на контейнер). */
  fullWidth?: boolean;
}

/** Полиморфные пропсы Button (дефолт `<button>`, любой элемент через `as`). */
export type IButtonProps<T extends ValidComponent = 'button'> = ISlotProps<T> & IButtonOwnProps;

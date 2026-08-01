import { createStyle } from '@omnifield/weber-style';
import { mergeProps, splitProps } from 'solid-js';
import type { ISpinnerProps } from './interfaces';
import { spinnerCva } from './variants';

/** Spinner — крутящийся индикатор загрузки. */
export const Spinner = (props: ISpinnerProps) => {
  const merged = mergeProps({ label: 'Loading' }, props);
  const [local, variants] = splitProps(merged, ['class', 'style', 'label']);

  const styleProps = mergeProps(variants, {
    get class() {
      return local.class;
    },
    get style() {
      return local.style;
    },
  });
  const { className, style } = createStyle(spinnerCva as never, styleProps);

  return (
    <span
      class={className()}
      style={style() as never}
      role="status"
      aria-label={local.label}
      data-slot="spinner"
    />
  );
};

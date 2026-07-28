import { cn, createStyle } from '@omnifield/weber-style';
import type { ValidComponent } from 'solid-js';
import { mergeProps, Show, splitProps } from 'solid-js';
import { Slot } from '../slot';
import { Spinner } from '../spinner';
import type { IButtonProps } from './interfaces';
import { buttonCva } from './variants';

/**
 * Button — полиморфная кнопка с CVA-вариантами (порт эталона предка 1:1).
 *
 * @example
 * ```tsx
 * <Button>Click</Button>
 * <Button variant="secondary" size="lg">Large</Button>
 * <Button as="a" href="/foo">Link</Button>
 * <Button loading>Sign in</Button>
 * ```
 */
export const Button = <T extends ValidComponent = 'button'>(props: IButtonProps<T>) => {
  const [local, variantProps, loadingProps, presentational, others] = splitProps(
    props,
    ['class', 'style'],
    ['variant', 'size'],
    ['loading', 'disabled', 'children'],
    ['fullWidth'],
  );

  const styleProps = mergeProps(variantProps, {
    get class() {
      return cn(local.class, presentational.fullWidth && 'w-full');
    },
    get style() {
      return local.style;
    },
  });
  const { className, style } = createStyle(buttonCva as never, styleProps);

  const [polyProps, domProps] = splitProps(others, ['as']);

  const isDisabled = () => !!(loadingProps.loading || loadingProps.disabled);

  const resolvedAs = () => (polyProps.as as ValidComponent | undefined) ?? 'button';
  const isButton = () => resolvedAs() === 'button';

  return (
    <Slot
      as={resolvedAs() as T}
      class={className()}
      style={style()}
      disabled={isDisabled()}
      // type="button" — не сабмитить формы случайно (только нативный <button>)
      type={isButton() ? 'button' : undefined}
      // data-slot — универсальный selector-хук (тесты/инспектор/канвас)
      data-slot="button"
      data-variant={variantProps.variant ?? 'default'}
      data-size={variantProps.size ?? 'default'}
      // data-disabled — Kobalte-конвенция для CSS-таргетинга
      data-disabled={isDisabled() ? '' : undefined}
      aria-busy={loadingProps.loading ? 'true' : undefined}
      data-busy={loadingProps.loading ? '' : undefined}
      {...(domProps as any)}
    >
      <Show when={loadingProps.loading} fallback={loadingProps.children}>
        <Spinner size="sm" />
      </Show>
    </Slot>
  );
};

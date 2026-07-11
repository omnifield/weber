import { Polymorphic } from '@kobalte/core/polymorphic';
import type { ValidComponent } from 'solid-js';
import { splitProps } from 'solid-js';
import type { ISlotProps } from './interfaces';

/**
 * Slot — полиморфная база кита (`as`-паттерн поверх Kobalte Polymorphic).
 * NOTE: useTrace предка не портирован — kit-observability вернётся слотом
 * с profiler-волной (см. OWNERSHIP).
 */
export const Slot = <T extends ValidComponent = 'div'>(props: ISlotProps<T>) => {
  const [polyProps, others] = splitProps(props, ['as']);
  return <Polymorphic as={(polyProps.as as T) ?? ('div' as T)} {...(others as any)} />;
};

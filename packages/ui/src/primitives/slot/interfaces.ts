import type { PolymorphicProps } from '@kobalte/core/polymorphic';
import type { ValidComponent } from 'solid-js';

/** Полиморфные пропсы Slot: любой элемент/компонент через `as`. */
export type ISlotProps<T extends ValidComponent = 'div'> = PolymorphicProps<T>;

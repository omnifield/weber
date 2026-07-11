import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export { cva, type VariantProps } from 'class-variance-authority';

/** Канонический класс-комбинатор кита: clsx + tailwind-merge. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Плоский merge стиль-словарей (правый выигрывает). Порт без es-toolkit. */
export function merge(
  obj1: Record<string, string>,
  obj2: Record<string, string>,
): Record<string, string> {
  return { ...obj1, ...obj2 };
}

import { type ClassValue, clsx } from 'clsx';
import { merge as esMerge } from 'es-toolkit';
import { twMerge } from 'tailwind-merge';

export { cva } from 'class-variance-authority';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function merge(obj1: Record<string, string>, obj2: Record<string, string>) {
  return esMerge(obj1, obj2);
}

import { type Accessor, createMemo } from 'solid-js';
import { cn } from './utils';

/**
 * Реактивная обвязка CVA для компонентов кита: className — мемо от props
 * (variant-чтения трекаются), style — сквозной геттер.
 */
export function createStyle(
  cvaFn: (props: unknown) => string,
  props: Record<string, unknown> & { class?: string; style?: unknown },
): { className: Accessor<string>; style: () => unknown } {
  const className = createMemo(() => cn(cvaFn(props), props.class));
  const style = () => props.style;
  return { className, style };
}

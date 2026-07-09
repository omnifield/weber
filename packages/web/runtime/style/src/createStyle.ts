import { createMemo } from 'solid-js';
import { cn } from './utils';

export function createStyle(cvaFn: any, props: any) {
  // Мы создаем мемо-производную, которая будет следить за изменениями
  const className = createMemo(() => {
    // Внутри мемо обращение к props.variant отслеживается автоматически
    return cn(cvaFn(props), props.class);
  });

  const style = () => props.style;

  return { className, style };
}

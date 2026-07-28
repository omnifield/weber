import { cva } from '@omnifield/weber-style';

export const variants = {
  variant: {
    default: 'bg-primary text-primary-foreground shadow hover:bg-primary/90',
    destructive: 'bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90',
    outline:
      'border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground',
    secondary: 'bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80',
    ghost: 'hover:bg-accent hover:text-accent-foreground',
    link: 'text-primary underline-offset-4 hover:underline',
  },
  size: {
    default: 'h-9 px-button has-[>svg]:px-[calc(var(--spacing-button)-0.25rem)]',
    sm: 'h-8 px-button-sm text-xs has-[>svg]:px-[calc(var(--spacing-button-sm)-0.125rem)]',
    lg: 'h-10 px-button-lg has-[>svg]:px-[calc(var(--spacing-button-lg)-0.5rem)]',
    icon: 'size-9 p-0',
    /** Inline icon-in-text (глиф в строке лейбла) — меньше `sm`. */
    xs: 'h-5 px-1 gap-1 text-xs has-[>svg]:px-0.5',
  },
};

export const buttonCva = cva(
  [
    // layout
    'inline-flex items-center justify-center gap-2 whitespace-nowrap',
    // semantics
    'rounded-md text-sm font-medium cursor-pointer',
    // transition — узкий (только цвета)
    'transition-colors duration-200',
    // focus — двухслойный (shadcn canon)
    'outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
    // disabled
    'disabled:pointer-events-none disabled:opacity-50',
    // aria-invalid (форма-валидация)
    'aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40',
    // aria-current="page" — активная nav-ссылка (атрибут ставит router Link)
    'aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground aria-[current=page]:font-semibold aria-[current=page]:pointer-events-none',
    // svg-children (адаптер для иконок)
    '[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*=size-])]:size-4',
  ].join(' '),
  {
    variants,
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

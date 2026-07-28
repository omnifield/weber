import { cva } from '@omnifield/weber-style';

export const spinnerCva = cva(
  'inline-block animate-spin rounded-full border-2 border-current border-t-transparent text-muted-foreground',
  {
    variants: {
      size: {
        sm: 'h-4 w-4',
        md: 'h-6 w-6',
        lg: 'h-8 w-8',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  },
);

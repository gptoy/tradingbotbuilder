import * as React from 'react';
import { cn } from '../../lib/utils';

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info' | 'ghost';

const variantClasses: Record<BadgeVariant, string> = {
  default:     'border-transparent bg-primary text-primary-foreground',
  secondary:   'border-transparent bg-secondary text-secondary-foreground',
  destructive: 'border-transparent bg-destructive text-destructive-foreground',
  outline:     'border-border text-foreground',
  success:     'border-transparent bg-emerald-100 text-emerald-800',
  warning:     'border-transparent bg-amber-100 text-amber-800',
  info:        'border-transparent bg-blue-100 text-blue-800',
  ghost:       'border-border bg-muted text-muted-foreground',
};

export type BadgeProps = React.ComponentPropsWithoutRef<'div'> & {
  variant?: BadgeVariant;
};

function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors',
        variantClasses[variant],
        className,
      )}
      {...props}
    />
  );
}

export { Badge };

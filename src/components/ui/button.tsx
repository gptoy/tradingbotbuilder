import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

/* Dub button vocabulary:
 * - default:    near-black fill (Midnight Ink #0a0a0a) — the ONE committed action per surface
 * - outline:    white bg + 1px ash border — workhorse for secondary actions
 * - ghost:      transparent, no border — nav items and subtle controls
 * - destructive: red fill — irreversible destructive action
 * - blue:       Electric Blue fill — for informational/link-style actions
 */
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-40 cursor-pointer [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        /* Dub: Filled Dark CTA — #0a0a0a bg, white text, 8px radius, subtle shadow */
        default:     'bg-midnight-ink text-white hover:bg-charcoal rounded-[8px] shadow-[rgba(0,0,0,0.05)_0px_1px_2px_0px]',
        /* Dub: Outlined Action — white bg, ash border, charcoal text */
        outline:     'bg-canvas-white border border-ash text-charcoal hover:bg-paper-mist rounded-[8px]',
        /* Dub: Ghost Nav — transparent, no border, for nav items and icon buttons */
        ghost:       'text-charcoal hover:bg-paper-mist rounded-[8px]',
        /* Destructive */
        destructive: 'bg-destructive text-white hover:bg-red-700 rounded-[8px] shadow-[rgba(0,0,0,0.05)_0px_1px_2px_0px]',
        /* Electric Blue — for link-style CTAs and informational actions */
        blue:        'bg-electric-blue text-white hover:bg-deep-sapphire rounded-[8px] shadow-[rgba(0,0,0,0.05)_0px_1px_2px_0px]',
        /* Soft — muted surface, graphite text */
        secondary:   'bg-paper-mist text-charcoal hover:bg-ash rounded-[8px]',
        /* Link style */
        link:        'text-electric-blue underline-offset-4 hover:underline p-0 h-auto',
        /* Trading domain colors — kept as semantic overrides */
        success:     'bg-vivid-green text-white hover:bg-green-700 rounded-[8px] shadow-[rgba(0,0,0,0.05)_0px_1px_2px_0px]',
        warning:     'bg-tangerine text-white hover:bg-orange-700 rounded-[8px] shadow-[rgba(0,0,0,0.05)_0px_1px_2px_0px]',
      },
      size: {
        default:   'h-9 px-4 py-2',
        sm:        'h-8 px-3 text-xs',
        lg:        'h-10 px-5',
        xl:        'h-11 px-6 text-base font-semibold',
        icon:      'h-9 w-9',
        'icon-sm': 'h-7 w-7',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };

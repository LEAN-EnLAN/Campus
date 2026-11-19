import { cva, type VariantProps } from 'class-variance-authority'
import { ArrowRight } from 'lucide-react'
import type { ButtonHTMLAttributes } from 'react'

import { cn } from '@/lib/utils'

/**
 * Campus button.
 *
 * Re-skinned to Campus tokens rather than shipping shadcn defaults. `primary` is
 * a pill — the one loud shape on a screen; `secondary` is a tinted ghost of the
 * accent; `ghost` is chrome; `danger` is solid for the confirm of something
 * irreversible and `danger-outline` for the door that leads there (Cerrar
 * sesión, Borrar…). `trailingArrow` adds the "→" a navigation CTA carries.
 */
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 font-medium whitespace-nowrap select-none ' +
    'transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-out-expo ' +
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ' +
    'motion-safe:active:scale-[0.98] ' +
    'disabled:pointer-events-none disabled:opacity-45 ' +
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        primary:
          'rounded-pill bg-accent text-on-tint shadow-raised hover:bg-accent-hover hover:shadow-floating/40',
        secondary:
          'rounded-pill border border-accent/15 bg-accent-soft text-accent-ink hover:border-accent/35 hover:bg-accent-soft/70',
        outline:
          'rounded-pill border border-rule bg-paper-elevated text-ink hover:border-field hover:bg-paper-sunken',
        ghost: 'rounded-lg text-ink-muted hover:bg-paper-sunken hover:text-ink',
        danger: 'rounded-pill bg-danger text-on-danger hover:bg-danger/90',
        'danger-outline':
          'rounded-pill border border-danger/40 bg-paper-elevated text-danger hover:border-danger hover:bg-danger-soft',
        link: 'rounded-sm text-accent-ink underline-offset-4 hover:underline',
      },
      size: {
        // Tap targets stay >=44px on touch; the compact sizes are pointer-only surfaces.
        md: 'h-11 px-5 text-sm',
        sm: 'h-8 px-3.5 text-xs',
        lg: 'h-12 px-6 text-base',
        icon: 'size-9 rounded-lg',
        'icon-touch': 'size-11 rounded-lg',
      },
    },
    defaultVariants: { variant: 'secondary', size: 'md' },
  },
)

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  /** A trailing "→" for buttons that take the student somewhere. Decorative. */
  trailingArrow?: boolean
}

export function Button({
  className,
  variant,
  size,
  type = 'button',
  trailingArrow = false,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(buttonVariants({ variant, size }), trailingArrow && 'group', className)}
      {...props}
    >
      {children}
      {trailingArrow ? (
        <ArrowRight
          aria-hidden="true"
          className="transition-transform duration-150 ease-out-expo motion-safe:group-hover:translate-x-0.5"
        />
      ) : null}
    </button>
  )
}

export { buttonVariants }

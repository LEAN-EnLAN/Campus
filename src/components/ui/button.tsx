import { cva, type VariantProps } from 'class-variance-authority'
import type { ButtonHTMLAttributes } from 'react'

import { cn } from '@/lib/utils'

/**
 * Campus button.
 *
 * Re-skinned to Campus tokens rather than shipping shadcn defaults — no zinc, no
 * default shadow stack. Quiet by default; `primary` is the one loud variant and a
 * screen should rarely need two of them.
 */
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-md font-medium whitespace-nowrap ' +
    'transition-colors duration-150 ease-[var(--ease-out-quiet)] ' +
    'disabled:pointer-events-none disabled:opacity-45 ' +
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        primary: 'bg-accent text-white hover:bg-accent-ink',
        secondary:
          'border border-rule bg-paper-elevated text-ink hover:border-ink-faint hover:bg-paper-sunken',
        ghost: 'text-ink-muted hover:bg-paper-sunken hover:text-ink',
        danger: 'border border-danger/30 bg-danger-soft text-danger hover:bg-danger/15',
        link: 'text-accent underline-offset-4 hover:underline',
      },
      size: {
        // Tap targets stay >=44px on touch; the compact sizes are pointer-only surfaces.
        md: 'h-10 px-4 text-sm',
        sm: 'h-8 px-3 text-xs',
        lg: 'h-11 px-5 text-base',
        icon: 'size-9',
        'icon-touch': 'size-11',
      },
    },
    defaultVariants: { variant: 'secondary', size: 'md' },
  },
)

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, type = 'button', ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  )
}

export { buttonVariants }

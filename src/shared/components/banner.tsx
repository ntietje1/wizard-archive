import type { ReactNode } from 'react'
import { Button } from '~/features/shadcn/components/button'
import { cn } from '~/features/shadcn/lib/utils'

const bannerVariants = {
  accent: 'border-primary/40 bg-accent text-accent-foreground',
  destructive:
    'border-destructive/40 bg-destructive/10 text-destructive dark:bg-destructive/20 dark:border-destructive/60 dark:text-destructive/70',
}

const buttonVariants = {
  accent: 'text-accent-foreground hover:text-accent-foreground hover:bg-foreground/5',
  destructive: 'text-destructive hover:text-destructive hover:bg-destructive/15',
}

type BannerVariant = keyof typeof bannerVariants

interface BannerProps {
  icon: ReactNode
  children: ReactNode
  actions?: ReactNode
  variant?: BannerVariant
  border?: 'top' | 'bottom'
}

export function Banner({
  icon,
  children,
  actions,
  variant = 'accent',
  border = 'bottom',
}: BannerProps) {
  return (
    <div
      role={variant === 'destructive' ? 'alert' : 'status'}
      aria-live={variant === 'destructive' ? 'assertive' : 'polite'}
      className={cn(
        'flex items-center justify-between px-3 h-8 shrink-0',
        border === 'top' ? 'border-t' : 'border-b',
        bannerVariants[variant],
      )}
    >
      <div className="flex items-center gap-1.5 text-xs font-medium min-w-0">
        {icon}
        <span className="truncate">{children}</span>
      </div>
      {actions && <div className="flex items-center gap-1 shrink-0">{actions}</div>}
    </div>
  )
}

interface BannerButtonProps {
  onClick: () => void
  children: ReactNode
  variant?: BannerVariant
  disabled?: boolean
}

export function BannerButton({
  onClick,
  children,
  variant = 'accent',
  disabled,
}: BannerButtonProps) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn('h-5 px-1.5 text-xs', buttonVariants[variant])}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </Button>
  )
}

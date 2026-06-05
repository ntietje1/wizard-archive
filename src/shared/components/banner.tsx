import type { ReactNode } from 'react'
import { Button } from '~/features/shadcn/components/button'
import { cn } from '~/features/shadcn/lib/utils'

const bannerVariants = {
  accent: 'border-primary/40 bg-accent text-accent-foreground',
  destructive:
    'border-feedback-destructive-border bg-feedback-destructive-surface text-feedback-destructive',
}

const buttonVariants = {
  accent: 'text-accent-foreground hover:text-accent-foreground hover:bg-foreground/5',
  destructive:
    'text-feedback-destructive hover:text-feedback-destructive hover:bg-feedback-destructive-action-hover',
  'on-destructive':
    'bg-transparent text-destructive-foreground hover:bg-transparent hover:text-destructive-foreground',
}

type BannerVariant = keyof typeof bannerVariants
type BannerButtonVariant = keyof typeof buttonVariants

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
  variant?: BannerButtonVariant
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

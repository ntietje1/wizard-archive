import { cn } from '@wizard-archive/ui/shadcn/lib/utils'

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
  'aria-label'?: string
  delayedFadeIn?: boolean
  fadeInSpeed?: 'fast' | 'normal' | 'slow'
}

const sizeClasses = {
  sm: 'h-4 w-4',
  md: 'h-8 w-8',
  lg: 'h-12 w-12',
} as const

const fadeInSpeedClasses = {
  fast: 'fade-in-delayed-fast',
  normal: 'fade-in-delayed',
  slow: 'fade-in-delayed-slow',
} as const

export function LoadingSpinner({
  size = 'md',
  className = '',
  'aria-label': ariaLabel = 'Loading',
  delayedFadeIn = false,
  fadeInSpeed = 'normal',
}: LoadingSpinnerProps) {
  const fadeInClasses = delayedFadeIn ? fadeInSpeedClasses[fadeInSpeed] : ''

  return (
    <output
      className={cn(
        'animate-spin rounded-full border-2 border-muted border-t-foreground',
        sizeClasses[size],
        fadeInClasses,
        className,
      )}
      aria-label={ariaLabel}
    />
  )
}

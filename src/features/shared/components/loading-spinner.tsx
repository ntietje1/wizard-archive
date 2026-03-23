interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
  'aria-label'?: string
  delayedFadeIn?: boolean
  fadeInSpeed?: 'fast' | 'normal' | 'slow'
}

export function LoadingSpinner({
  size = 'md',
  className = '',
  'aria-label': ariaLabel = 'Loading',
  delayedFadeIn = false,
  fadeInSpeed = 'normal',
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
  }

  const fadeInClasses = delayedFadeIn
    ? fadeInSpeed === 'fast'
      ? 'fade-in-delayed-fast'
      : fadeInSpeed === 'slow'
        ? 'fade-in-delayed-slow'
        : 'fade-in-delayed'
    : ''

  return (
    <div
      className={`animate-spin rounded-full border-2 border-muted border-t-foreground ${sizeClasses[size]} ${fadeInClasses} ${className}`}
      role="status"
      aria-label={ariaLabel}
    >
      <span className="sr-only">{ariaLabel}</span>
    </div>
  )
}

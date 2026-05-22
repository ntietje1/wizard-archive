import type { CSSProperties, ReactNode } from 'react'
import { cn } from '~/features/shadcn/lib/utils'

interface CheckerboardSwatchProps {
  children?: ReactNode
  className?: string
  style?: CSSProperties
}

const CHECKERBOARD_PATTERN = [
  'linear-gradient(45deg, color-mix(in srgb, var(--foreground) 10%, var(--background)) 25%, transparent 25%, transparent 75%, color-mix(in srgb, var(--foreground) 10%, var(--background)) 75%, color-mix(in srgb, var(--foreground) 10%, var(--background)))',
  'linear-gradient(45deg, color-mix(in srgb, var(--foreground) 10%, var(--background)) 25%, transparent 25%, transparent 75%, color-mix(in srgb, var(--foreground) 10%, var(--background)) 75%, color-mix(in srgb, var(--foreground) 10%, var(--background)))',
].join(', ')

export function CheckerboardSwatch({ children, className, style }: CheckerboardSwatchProps) {
  return (
    <span
      className={cn('block overflow-hidden', className)}
      style={{
        backgroundColor: 'var(--background)',
        backgroundImage: CHECKERBOARD_PATTERN,
        backgroundPosition: '0 0, 4px 4px',
        backgroundSize: '8px 8px',
        ...style,
      }}
    >
      {children}
    </span>
  )
}

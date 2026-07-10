import type { CSSProperties, ReactNode } from 'react'
import { cn } from '@wizard-archive/ui/shadcn/lib/utils'

interface CheckerboardSwatchProps {
  children?: ReactNode
  className?: string
  overlayImage?: string
  style?: CSSProperties
}

const CHECKERBOARD_GRADIENT =
  'linear-gradient(45deg, color-mix(in srgb, var(--foreground) 10%, var(--background)) 25%, transparent 25%, transparent 75%, color-mix(in srgb, var(--foreground) 10%, var(--background)) 75%, color-mix(in srgb, var(--foreground) 10%, var(--background)))'
const CHECKERBOARD_PATTERN = [CHECKERBOARD_GRADIENT, CHECKERBOARD_GRADIENT].join(', ')

export function CheckerboardSwatch({
  children,
  className,
  overlayImage,
  style,
}: CheckerboardSwatchProps) {
  return (
    <span
      className={cn('block overflow-hidden', className)}
      style={{
        backgroundColor: 'var(--background)',
        backgroundImage: overlayImage
          ? `${overlayImage}, ${CHECKERBOARD_PATTERN}`
          : CHECKERBOARD_PATTERN,
        backgroundPosition: overlayImage ? '0 0, 0 0, 4px 4px' : '0 0, 4px 4px',
        backgroundSize: overlayImage ? '100% 100%, 8px 8px, 8px 8px' : '8px 8px',
        ...style,
      }}
    >
      {children}
    </span>
  )
}

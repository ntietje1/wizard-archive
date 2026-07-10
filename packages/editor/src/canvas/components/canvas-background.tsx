import type { Ref } from 'react'
import { CANVAS_BACKGROUND_GRID_SIZE } from './canvas-background-viewport-style'

interface CanvasBackgroundProps {
  backgroundRef?: Ref<HTMLDivElement>
  testId?: string
}

export function CanvasBackground({ backgroundRef, testId }: CanvasBackgroundProps) {
  return (
    <div
      ref={backgroundRef}
      className="pointer-events-none absolute inset-0"
      data-testid={testId}
      style={{
        backgroundColor: 'var(--background)',
        backgroundImage:
          'radial-gradient(circle at 1px 1px, color-mix(in srgb, var(--foreground) 14%, transparent) 1px, transparent 0)',
        backgroundSize: `${CANVAS_BACKGROUND_GRID_SIZE}px ${CANVAS_BACKGROUND_GRID_SIZE}px`,
      }}
    />
  )
}

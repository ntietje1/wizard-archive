import type { Ref } from 'react'

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
        backgroundSize: '24px 24px',
      }}
    />
  )
}

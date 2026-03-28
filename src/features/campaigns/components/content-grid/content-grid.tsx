import type { ReactNode } from 'react'

interface ContentGridProps {
  children: ReactNode
  className?: string
  'data-testid'?: string
}

export function ContentGrid({
  children,
  className = '',
  'data-testid': dataTestId,
}: ContentGridProps) {
  return (
    <div
      data-testid={dataTestId}
      className={`grid w-full min-h-full max-w-full min-w-0 gap-6 items-start mb-10 ${className}`}
      style={{
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
      }}
    >
      {children}
    </div>
  )
}

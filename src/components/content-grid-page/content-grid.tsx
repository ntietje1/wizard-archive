import type { ReactNode } from 'react'

interface ContentGridProps {
  children: ReactNode
  className?: string
}

export function ContentGrid({ children, className = '' }: ContentGridProps) {
  return (
    <div
      className={`grid w-full min-h-full gap-6 ${className}`}
      style={{
        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
      }}
    >
      {children}
    </div>
  )
}

import { ErrorBoundary } from '@wizard-archive/ui/components/error-boundary'
import { ErrorFallback } from '@wizard-archive/ui/components/error-fallback'
import type { ReactNode } from 'react'

interface WorkspaceSurfaceProps {
  banner?: ReactNode
  children: ReactNode
  rightSidebar?: ReactNode
  topbar: ReactNode
}

export function WorkspaceSurface({
  banner = null,
  children,
  rightSidebar = null,
  topbar,
}: WorkspaceSurfaceProps) {
  return (
    <div className="flex flex-col flex-1 min-h-0 min-w-0 overflow-hidden">
      <ErrorBoundary FallbackComponent={ErrorFallback}>{topbar}</ErrorBoundary>
      {banner && <ErrorBoundary FallbackComponent={ErrorFallback}>{banner}</ErrorBoundary>}
      <div className="relative flex flex-1 min-h-0 min-w-0">
        <div className="relative flex flex-col flex-1 min-h-0 min-w-0">
          <ErrorBoundary FallbackComponent={ErrorFallback}>{children}</ErrorBoundary>
        </div>
        {rightSidebar && (
          <ErrorBoundary FallbackComponent={ErrorFallback}>{rightSidebar}</ErrorBoundary>
        )}
      </div>
    </div>
  )
}

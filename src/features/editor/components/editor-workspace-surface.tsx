import { ErrorBoundary } from '~/shared/components/error-boundary'
import { ErrorFallback } from '~/shared/components/error-fallback'
import type { ReactNode } from 'react'

interface EditorWorkspaceSurfaceProps {
  banner?: ReactNode
  children: ReactNode
  rightSidebar?: ReactNode
  topbar: ReactNode
}

export function EditorWorkspaceSurface({
  banner = null,
  children,
  rightSidebar = null,
  topbar,
}: EditorWorkspaceSurfaceProps) {
  return (
    <div className="flex flex-col flex-1 min-h-0 min-w-0 overflow-hidden">
      {topbar}
      {banner}
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

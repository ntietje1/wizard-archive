import { EditorContent } from '../components/editor-content'
import { FileTopbar } from '../components/topbar/file-topbar'
import { RightSidebarContainer } from '../components/right-sidebar/right-sidebar-container'
import { useSelectedItemSync } from '~/features/sidebar/hooks/useSelectedItem'
import { ErrorBoundary } from '~/shared/components/error-boundary'
import { ErrorFallback } from '~/shared/components/error-fallback'

export function EditorPage() {
  useSelectedItemSync()

  return (
    <div className="flex flex-col flex-1 min-h-0 min-w-0 overflow-hidden">
      <FileTopbar />
      <div className="relative flex flex-1 min-h-0 min-w-0">
        <div className="relative flex flex-col flex-1 min-h-0 min-w-0">
          <ErrorBoundary FallbackComponent={ErrorFallback}>
            <EditorContent />
          </ErrorBoundary>
        </div>
        <ErrorBoundary FallbackComponent={ErrorFallback}>
          <RightSidebarContainer />
        </ErrorBoundary>
      </div>
    </div>
  )
}

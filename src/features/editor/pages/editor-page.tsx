import { EditorContent } from '../components/editor-content'
import { FileTopbar } from '../components/topbar/file-topbar'
import { useSelectedItemSync } from '~/features/sidebar/hooks/useSelectedItem'
import { ErrorBoundary } from '~/shared/components/error-boundary'
import { ErrorFallback } from '~/shared/components/error-fallback'

export function EditorPage() {
  useSelectedItemSync()

  return (
    <div className="flex flex-col flex-1 min-h-0 min-w-0 overflow-hidden">
      <FileTopbar />
      <ErrorBoundary FallbackComponent={ErrorFallback}>
        <EditorContent />
      </ErrorBoundary>
    </div>
  )
}

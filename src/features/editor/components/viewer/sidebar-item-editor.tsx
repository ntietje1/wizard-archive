import { useEffect } from 'react'
import type { AnySidebarItemWithContent } from 'shared/sidebar-items/model-types'
import { SidebarItemViewer } from '~/features/editor/components/viewer/sidebar-item-viewer'
import { ErrorBoundary } from '~/shared/components/error-boundary'
import { ErrorFallback } from '~/shared/components/error-fallback'
import type { EditorWorkspaceSource } from '~/features/editor/workspace/editor-workspace-source'
import type { ViewerProps } from '~/shared/viewer/viewer-props'

type SidebarItemEditorProps = ViewerProps<AnySidebarItemWithContent> & {
  historyPreview: EditorWorkspaceSource['historyPreview']
}

export function SidebarItemEditor({ historyPreview, item }: SidebarItemEditorProps) {
  const { clearItemSession, PreviewComponent, previewingEntryId, RollbackDialogComponent } =
    historyPreview

  useEffect(() => {
    return () => clearItemSession(item._id)
  }, [item._id, clearItemSession])

  if (previewingEntryId) {
    return (
      <>
        <ErrorBoundary FallbackComponent={ErrorFallback} key={`preview-${previewingEntryId}`}>
          <PreviewComponent itemId={item._id} entryId={previewingEntryId} />
        </ErrorBoundary>
        <RollbackDialogComponent itemId={item._id} />
      </>
    )
  }

  return (
    <>
      <ErrorBoundary FallbackComponent={ErrorFallback} key={item._id}>
        <SidebarItemViewer item={item} />
      </ErrorBoundary>
      <RollbackDialogComponent itemId={item._id} />
    </>
  )
}

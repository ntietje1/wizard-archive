import { useEffect } from 'react'
import type { AnySidebarItemWithContent } from 'shared/sidebar-items/model-types'
import { LiveHistoryPreviewViewer } from '~/features/editor/components/viewer/live-history-preview-viewer'
import { LiveRollbackConfirmDialog } from '~/features/editor/components/viewer/live-rollback-confirm-dialog'
import { SidebarItemViewer } from '~/features/editor/components/viewer/sidebar-item-viewer'
import { ErrorBoundary } from '~/shared/components/error-boundary'
import { ErrorFallback } from '~/shared/components/error-fallback'
import { useHistoryPreviewStore } from '~/features/editor/stores/history-preview-store'
import type { ViewerProps } from '~/shared/viewer/viewer-props'

type SidebarItemEditorProps = ViewerProps<AnySidebarItemWithContent>

export function SidebarItemEditor({ item }: SidebarItemEditorProps) {
  const previewingEntryId = useHistoryPreviewStore((s) =>
    s.preview?.itemId === item._id ? s.preview.entryId : null,
  )
  const clearItemSession = useHistoryPreviewStore((s) => s.clearItemSession)

  useEffect(() => {
    return () => clearItemSession(item._id)
  }, [item._id, clearItemSession])

  if (previewingEntryId) {
    return (
      <>
        <ErrorBoundary FallbackComponent={ErrorFallback} key={`preview-${previewingEntryId}`}>
          <LiveHistoryPreviewViewer itemId={item._id} entryId={previewingEntryId} />
        </ErrorBoundary>
        <LiveRollbackConfirmDialog itemId={item._id} />
      </>
    )
  }

  return (
    <>
      <ErrorBoundary FallbackComponent={ErrorFallback} key={item._id}>
        <SidebarItemViewer item={item} />
      </ErrorBoundary>
      <LiveRollbackConfirmDialog itemId={item._id} />
    </>
  )
}

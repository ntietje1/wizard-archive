import { useEffect } from 'react'
import { SIDEBAR_ITEM_TYPES } from 'shared/sidebar-items/types'
import type { AnySidebarItemWithContent } from 'shared/sidebar-items/model-types'
import { assertNever } from '~/shared/utils/utils'
import { NoteEditor } from '~/features/editor/components/viewer/note/note-editor'
import { MapViewer } from '~/features/editor/components/viewer/map/map-viewer'
import { FolderViewer } from '~/features/editor/components/viewer/folder/folder-viewer'
import { FileViewer } from '~/features/editor/components/viewer/file/file-viewer'
import { CanvasViewer } from '~/features/canvas/components/canvas-viewer'
import { HistoryPreviewViewer } from '~/features/editor/components/viewer/history-preview-viewer'
import { RollbackConfirmDialog } from '~/features/editor/components/viewer/rollback-confirm-dialog'
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
          <HistoryPreviewViewer itemId={item._id} entryId={previewingEntryId} />
        </ErrorBoundary>
        <RollbackConfirmDialog itemId={item._id} />
      </>
    )
  }

  const loadedItem = item
  const content = (() => {
    switch (loadedItem.type) {
      case SIDEBAR_ITEM_TYPES.notes:
        return <NoteEditor item={loadedItem} />
      case SIDEBAR_ITEM_TYPES.gameMaps:
        return <MapViewer key={loadedItem._id} item={loadedItem} />
      case SIDEBAR_ITEM_TYPES.folders:
        return <FolderViewer key={loadedItem._id} item={loadedItem} />
      case SIDEBAR_ITEM_TYPES.files:
        return <FileViewer key={loadedItem._id} item={loadedItem} />
      case SIDEBAR_ITEM_TYPES.canvases:
        return <CanvasViewer key={loadedItem._id} item={loadedItem} />
      default:
        return assertNever(loadedItem)
    }
  })()

  return (
    <>
      <ErrorBoundary FallbackComponent={ErrorFallback} key={item._id}>
        {content}
      </ErrorBoundary>
      <RollbackConfirmDialog itemId={item._id} />
    </>
  )
}

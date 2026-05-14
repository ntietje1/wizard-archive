import { useEffect } from 'react'
import { SIDEBAR_ITEM_TYPES } from 'convex/sidebarItems/types/baseTypes'
import type { AnySidebarItemWithContent } from 'convex/sidebarItems/types/types'
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

export interface EditorViewerProps<T extends AnySidebarItemWithContent> {
  item: T
  search?: unknown
}

export function SidebarItemEditor({ item, search }: EditorViewerProps<AnySidebarItemWithContent>) {
  const previewingEntryId = useHistoryPreviewStore((s) => s.previewingEntryId)
  const clearPreview = useHistoryPreviewStore((s) => s.clearPreview)

  useEffect(() => {
    clearPreview()
  }, [item._id, clearPreview])

  if (previewingEntryId) {
    return (
      <>
        <ErrorBoundary FallbackComponent={ErrorFallback} key={`preview-${previewingEntryId}`}>
          <HistoryPreviewViewer entryId={previewingEntryId} />
        </ErrorBoundary>
        <RollbackConfirmDialog />
      </>
    )
  }

  const loadedItem = item
  const content = (() => {
    switch (loadedItem.type) {
      case SIDEBAR_ITEM_TYPES.notes:
        return <NoteEditor item={loadedItem} search={search} />
      case SIDEBAR_ITEM_TYPES.gameMaps:
        return <MapViewer key={loadedItem._id} item={loadedItem} search={search} />
      case SIDEBAR_ITEM_TYPES.folders:
        return <FolderViewer key={loadedItem._id} item={loadedItem} search={search} />
      case SIDEBAR_ITEM_TYPES.files:
        return <FileViewer key={loadedItem._id} item={loadedItem} search={search} />
      case SIDEBAR_ITEM_TYPES.canvases:
        return <CanvasViewer key={loadedItem._id} item={loadedItem} search={search} />
      default:
        return assertNever(loadedItem)
    }
  })()

  return (
    <>
      <ErrorBoundary FallbackComponent={ErrorFallback} key={item._id}>
        {content}
      </ErrorBoundary>
      <RollbackConfirmDialog />
    </>
  )
}

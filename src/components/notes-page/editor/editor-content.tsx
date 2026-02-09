import { useDroppable } from '@dnd-kit/core'
import { SidebarItemEditor } from '../viewer/sidebar-item-editor'
import { CreateNewDashboard } from './create-new-dashboard'
import { useCurrentItem } from '~/hooks/useCurrentItem'
import { LoadingSpinner } from '~/components/loading/loading-spinner'
import { useFileDragDrop } from '~/hooks/useFileDragDrop'
import { EMPTY_EDITOR_DROP_TYPE, canDropItem } from '~/lib/dnd-utils'
import { cn } from '~/lib/shadcn/utils'
import { useEditorMode } from '~/hooks/useEditorMode'

export function EditorContent() {
  const { item, editorSearch, isLoading, hasRequestedItem } = useCurrentItem()
  const { viewAsPlayerId } = useEditorMode()

  if (isLoading) {
    return (
      <div className="flex-1 min-h-0 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!item) {
    if (viewAsPlayerId && hasRequestedItem) {
      return <NotSharedContent />
    }
    return <EmptyEditorContent />
  }

  return <SidebarItemEditor item={item} search={editorSearch} />
}

function EmptyEditorContent() {
  const dropData = { type: EMPTY_EDITOR_DROP_TYPE }
  const { setNodeRef, isOver, active, over } = useDroppable({
    id: EMPTY_EDITOR_DROP_TYPE,
    data: dropData,
  })

  const canDrop = canDropItem(active, over)
  const isValidDrop = isOver && canDrop

  const {
    isDraggingFiles,
    handleDragEnter,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  } = useFileDragDrop(undefined) // root level, so parentId is undefined

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex-1 min-h-0 flex items-center justify-center transition-colors',
        isValidDrop && 'bg-muted',
        isDraggingFiles && 'bg-muted/50',
      )}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <CreateNewDashboard />
    </div>
  )
}

function NotSharedContent() {
  return (
    <div className="flex-1 min-h-0 flex items-center justify-center">
      <div className="text-center text-muted-foreground">
        <p>This page doesn't exist or isn't shared with you.</p>
      </div>
    </div>
  )
}

import { useDroppable } from '@dnd-kit/core'
import { SIDEBAR_ITEM_TYPES } from 'convex/sidebarItems/types'
import { SidebarItemEditor } from '../viewer/sidebar-item-editor'
import { useCurrentItem } from '~/hooks/useCurrentItem'
import { LoadingSpinner } from '~/components/loading/loading-spinner'
import { useNoteActions } from '~/hooks/useNoteActions'
import { useCampaign } from '~/hooks/useCampaign'
import { useEditorNavigation } from '~/hooks/useEditorNavigation'
import { useFileDragDrop } from '~/hooks/useFileDragDrop'
import { EMPTY_EDITOR_DROP_TYPE, canDropItem } from '~/lib/dnd-utils'
import { cn } from '~/lib/shadcn/utils'

export function EditorContent() {
  const { item, search, isLoading } = useCurrentItem()

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!item) {
    return <EmptyEditorContent />
  }

  return <SidebarItemEditor item={item} search={search} />
}

function EmptyEditorContent() {
  const { navigateToNote } = useEditorNavigation()
  const { campaignWithMembership } = useCampaign()
  const campaignId = campaignWithMembership.data?.campaign._id
  const { createNote } = useNoteActions()

  const handleCreateNote = () => {
    if (!campaignId) return
    createNote.mutateAsync({ campaignId: campaignId }).then(({ slug }) => {
      navigateToNote(slug, true)
    })
  }

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
        'h-full flex items-center justify-center transition-colors',
        isValidDrop && 'bg-muted',
        isDraggingFiles && 'bg-muted/50',
      )}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <span
        className="text-amber-600 hover:underline underline-offset-2 cursor-pointer"
        onClick={handleCreateNote}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            handleCreateNote()
          }
        }}
      >
        Create new note
      </span>
    </div>
  )
}

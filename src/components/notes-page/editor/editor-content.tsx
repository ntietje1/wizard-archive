import { useDroppable } from '@dnd-kit/core'
import { toast } from 'sonner'
import { SidebarItemEditor } from '../viewer/sidebar-item-editor'
import { CreateNewDashboard } from './create-new-dashboard'
import { LoadingSpinner } from '~/components/loading/loading-spinner'
import { EMPTY_EDITOR_DROP_TYPE, canDropItem } from '~/lib/dnd-utils'
import { getItemTypeLabel, getTypeAndSlug } from '~/lib/sidebar-item-utils'
import { cn } from '~/lib/shadcn/utils'
import { useCampaign } from '~/hooks/useCampaign'
import { useCurrentItem } from '~/hooks/useCurrentItem'
import { useEditorMode } from '~/hooks/useEditorMode'
import { useEditorNavigation } from '~/hooks/useEditorNavigation'
import { useFileDragDrop } from '~/hooks/useFileDragDrop'
import { useSidebarItemMutations } from '~/hooks/useSidebarItemMutations'
import { useOpenParentFolders } from '~/hooks/useOpenParentFolders'

export function EditorContent() {
  const { viewAsPlayerId } = useEditorMode()
  const { item, editorSearch, isLoading, hasRequestedItem } =
    useCurrentItem(viewAsPlayerId)

  if (isLoading) {
    return (
      <div className="flex-1 min-h-0 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!item) {
    if (hasRequestedItem) {
      return <NotSharedContent />
    } else {
      return <EmptyEditorContent />
    }
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
  } = useFileDragDrop(undefined)

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
  const { isDm } = useCampaign()
  const { item, editorSearch } = useCurrentItem()
  const { campaignWithMembership } = useCampaign()
  const campaignId = campaignWithMembership.data?.campaign._id
  const { createItem } = useSidebarItemMutations()
  const { navigateToItem } = useEditorNavigation()
  const { openParentFolders } = useOpenParentFolders()

  const typeAndSlug = getTypeAndSlug(editorSearch)
  const requestedType = typeAndSlug?.type

  const handleCreate = () => {
    if (!campaignId || !requestedType) return

    try {
      const result = createItem({ type: requestedType, campaignId })
      if (!result) return

      openParentFolders(result.tempId)
      navigateToItem(result.optimisticItem)
    } catch (error) {
      console.error('Failed to create item:', error)
      const typeLabel = requestedType ? getItemTypeLabel(requestedType) : 'item'
      toast.error(`Failed to create ${typeLabel}`)
    }
  }

  const itemTypeLabel = requestedType ? getItemTypeLabel(requestedType) : 'page'

  return (
    <div className="flex-1 min-h-0 flex items-center justify-center">
      <div className="text-center text-muted-foreground">
        <p>
          {isDm
            ? `This ${itemTypeLabel.toLowerCase()} doesn't exist.`
            : `This ${itemTypeLabel.toLowerCase()} doesn't exist or isn't shared with you.`}
        </p>
        {!item && requestedType && (
          <p className="mt-2">
            <button
              onClick={handleCreate}
              className="underline underline-offset-4 hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Create it
            </button>
          </p>
        )}
      </div>
    </div>
  )
}

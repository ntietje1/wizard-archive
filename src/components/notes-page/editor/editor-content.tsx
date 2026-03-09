import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { PERMISSION_LEVEL } from 'convex/permissions/types'
import { SidebarItemEditor } from '../viewer/sidebar-item-editor'
import { TrashPageViewer } from '../viewer/trash/trash-page-viewer'
import { CreateNewDashboard } from './create-new-dashboard'
import { LoadingSpinner } from '~/components/loading/loading-spinner'
import { EMPTY_EDITOR_DROP_TYPE } from '~/lib/dnd-registry'
import { getItemTypeLabel, getTypeAndSlug } from '~/lib/sidebar-item-utils'
import { cn } from '~/lib/shadcn/utils'
import { effectiveHasAtLeastPermission } from '~/lib/permission-utils'
import { useCampaign } from '~/hooks/useCampaign'
import { useCampaignMembers } from '~/hooks/useCampaignMembers'
import { useCurrentItem } from '~/hooks/useCurrentItem'
import { useDndDropTarget } from '~/hooks/useDndDropTarget'
import { useEditorMode } from '~/hooks/useEditorMode'
import { useEditorNavigation } from '~/hooks/useEditorNavigation'
import { useExternalDropTarget } from '~/hooks/useExternalDropTarget'
import { useAllSidebarItems } from '~/hooks/useSidebarItems'
import { useSidebarUIStore } from '~/stores/sidebarUIStore'
import { useSidebarItemMutations } from '~/hooks/useSidebarItemMutations'
import { useOpenParentFolders } from '~/hooks/useOpenParentFolders'

export function EditorContent() {
  const { item, editorSearch, isLoading, isNotFound, hasRequestedItem } =
    useCurrentItem()
  const { isDm } = useCampaign()
  const { viewAsPlayerId } = useEditorMode()
  const { itemsMap } = useAllSidebarItems()

  const canView =
    !!item &&
    effectiveHasAtLeastPermission(item, PERMISSION_LEVEL.VIEW, {
      isDm,
      viewAsPlayerId,
      allItemsMap: itemsMap,
    })

  if (isLoading) {
    return (
      <div className="flex-1 min-h-0 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  // Show trash page when ?trash=true and no specific item selected
  if (editorSearch.trash === true && !item) {
    return <TrashPageViewer />
  }

  if (!canView) {
    if (isNotFound || hasRequestedItem) {
      return <NotSharedContent />
    }
    return <EmptyEditorContent />
  }

  return <SidebarItemEditor item={item} search={editorSearch} />
}

function EmptyEditorContent() {
  const { isDm, isCampaignLoaded } = useCampaign()
  const ref = useRef<HTMLDivElement>(null)

  const { isDropTarget } = useDndDropTarget({
    ref,
    data: { type: EMPTY_EDITOR_DROP_TYPE },
    highlightId: EMPTY_EDITOR_DROP_TYPE,
  })

  useExternalDropTarget({
    ref,
    parentId: null,
    canAcceptFiles: true,
  })

  const isDraggingFiles = useSidebarUIStore((s) => s.isDraggingFiles)
  const fileDragHoveredId = useSidebarUIStore((s) => s.fileDragHoveredId)
  const isFileDragTarget = isDraggingFiles && fileDragHoveredId === null

  return (
    <div
      ref={ref}
      className={cn(
        'flex-1 min-h-0 flex items-center justify-center',
        isDropTarget &&
          !isFileDragTarget &&
          'ring-2 ring-inset ring-ring/60 bg-ring/5',
        isFileDragTarget && 'ring-2 ring-inset ring-ring/40 bg-ring/5',
      )}
    >
      {!isCampaignLoaded ? null : isDm ? (
        <CreateNewDashboard parentId={null} />
      ) : (
        <p className="text-muted-foreground">
          Select an item from the sidebar to view it.
        </p>
      )}
    </div>
  )
}

function NotSharedContent() {
  const { isDm, campaignId } = useCampaign()
  const { editorSearch } = useCurrentItem()
  const { viewAsPlayerId } = useEditorMode()
  const { data: allItems } = useAllSidebarItems()
  const campaignMembersQuery = useCampaignMembers()
  const { createItem, getDefaultName } = useSidebarItemMutations()
  const { navigateToItem } = useEditorNavigation()
  const { openParentFolders } = useOpenParentFolders()
  const [isPending, setIsPending] = useState(false)

  const typeAndSlug = getTypeAndSlug(editorSearch)
  const requestedType = typeAndSlug?.type

  // Check if the item exists in the full sidebar list (DM sees all items)
  const itemExists =
    typeAndSlug &&
    allItems.some(
      (i) => i.type === typeAndSlug.type && i.slug === typeAndSlug.slug,
    )

  // Resolve the viewed player's display name
  const viewAsPlayerName = (() => {
    if (!viewAsPlayerId) return undefined
    const member = campaignMembersQuery.data?.find(
      (m) => m._id === viewAsPlayerId,
    )
    if (!member) return undefined
    return (
      member.userProfile.name ||
      (member.userProfile.username
        ? `@${member.userProfile.username}`
        : undefined)
    )
  })()

  const handleCreate = async () => {
    if (!campaignId || !requestedType || isPending) return

    setIsPending(true)
    try {
      const result = await createItem({
        type: requestedType,
        campaignId,
        parentId: null,
        name: getDefaultName(requestedType, null),
      })
      openParentFolders(result.id)
      navigateToItem(result)
    } catch (error) {
      console.error('Failed to create item:', error)
      const typeLabel = requestedType ? getItemTypeLabel(requestedType) : 'item'
      toast.error(`Failed to create ${typeLabel}`)
    } finally {
      setIsPending(false)
    }
  }

  const itemTypeLabel = requestedType ? getItemTypeLabel(requestedType) : 'page'

  const getMessage = () => {
    if (itemExists) {
      const target = viewAsPlayerName ?? 'you'
      return `This ${itemTypeLabel.toLowerCase()} isn't shared with ${target}.`
    }
    if (isDm) {
      return `This ${itemTypeLabel.toLowerCase()} doesn't exist.`
    }
    return `This ${itemTypeLabel.toLowerCase()} doesn't exist or isn't shared with you.`
  }

  return (
    <div className="flex-1 min-h-0 flex items-center justify-center">
      <div className="text-center text-muted-foreground">
        <p>{getMessage()}</p>
        {!itemExists && isDm && requestedType && (
          <p className="mt-2">
            <button
              onClick={handleCreate}
              disabled={isPending}
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

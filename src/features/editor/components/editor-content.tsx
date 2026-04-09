import { Suspense, lazy, useRef, useState } from 'react'
import { PERMISSION_LEVEL } from 'convex/permissions/types'
import { SIDEBAR_ITEM_TYPES } from 'convex/sidebarItems/types/baseTypes'
import { TrashPageViewer } from './viewer/trash/trash-page-viewer'
import { CreateNewDashboard } from './create-new-dashboard'
import { LoadingSpinner } from '~/shared/components/loading-spinner'
import { EMPTY_EDITOR_DROP_TYPE } from '~/features/dnd/utils/dnd-registry'
import { getSlug } from '~/features/sidebar/utils/sidebar-item-utils'
import { cn } from '~/features/shadcn/lib/utils'
import { effectiveHasAtLeastPermission } from '~/features/sharing/utils/permission-utils'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { useCampaignMembers } from '~/features/players/hooks/useCampaignMembers'
import { useCurrentItem } from '~/features/sidebar/hooks/useCurrentItem'
import { useDndDropTarget } from '~/features/dnd/hooks/useDndDropTarget'
import { useEditorMode } from '~/features/sidebar/hooks/useEditorMode'
import { useEditorNavigation } from '~/features/sidebar/hooks/useEditorNavigation'
import { useExternalDropTarget } from '~/features/dnd/hooks/useExternalDropTarget'
import { useActiveSidebarItems } from '~/features/sidebar/hooks/useSidebarItems'
import { Button } from '~/features/shadcn/components/button'
import { useDndStore } from '~/features/dnd/stores/dnd-store'
import { useCreateSidebarItem } from '~/features/sidebar/hooks/useCreateSidebarItem'
import { useSidebarValidation } from '~/features/sidebar/hooks/useSidebarValidation'
import { useOpenParentFolders } from '~/features/sidebar/hooks/useOpenParentFolders'
import { handleError } from '~/shared/utils/logger'

const SidebarItemEditor = lazy(() =>
  import('./viewer/sidebar-item-editor').then((m) => ({
    default: m.SidebarItemEditor,
  })),
)

function EditorLoading() {
  return (
    <div className="flex-1 min-h-0 flex items-center justify-center">
      <LoadingSpinner size="lg" />
    </div>
  )
}

export function EditorContent() {
  const { item, editorSearch, isLoading, hasRequestedItem } = useCurrentItem()
  const { isDm } = useCampaign()
  const { viewAsPlayerId } = useEditorMode()
  const { itemsMap } = useActiveSidebarItems()

  const canView =
    !!item &&
    effectiveHasAtLeastPermission(item, PERMISSION_LEVEL.VIEW, {
      isDm,
      viewAsPlayerId,
      allItemsMap: itemsMap,
    })

  if (isLoading) {
    return <EditorLoading />
  }

  // Show trash page when ?trash=true and no specific item selected
  if (editorSearch.trash === true && !item) {
    return <TrashPageViewer />
  }

  if (!canView) {
    if (hasRequestedItem) {
      return <NotSharedContent />
    }
    return <EmptyEditorContent />
  }

  return (
    <Suspense fallback={<EditorLoading />}>
      <SidebarItemEditor item={item} search={editorSearch} />
    </Suspense>
  )
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

  const isDraggingFiles = useDndStore((s) => s.isDraggingFiles)
  const fileDragHoveredId = useDndStore((s) => s.fileDragHoveredId)
  const isFileDragTarget = isDraggingFiles && fileDragHoveredId === null

  return (
    <div
      ref={ref}
      className={cn(
        'flex-1 min-h-0 flex items-center justify-center',
        isDropTarget && !isFileDragTarget && 'ring-2 ring-inset ring-ring/60 bg-ring/5',
        isFileDragTarget && 'ring-2 ring-inset ring-ring/40 bg-ring/5',
      )}
    >
      {!isCampaignLoaded ? null : isDm ? (
        <CreateNewDashboard parentId={null} />
      ) : (
        <p className="text-muted-foreground">Select an item from the sidebar to view it.</p>
      )}
    </div>
  )
}

function NotSharedContent() {
  const { isDm, campaignId } = useCampaign()
  const { editorSearch } = useCurrentItem()
  const { viewAsPlayerId } = useEditorMode()
  const { data: allItems } = useActiveSidebarItems()
  const campaignMembersQuery = useCampaignMembers()
  const { createItem } = useCreateSidebarItem()
  const { getDefaultName } = useSidebarValidation()
  const { navigateToItem } = useEditorNavigation()
  const { openParentFolders } = useOpenParentFolders()
  const [isPending, setIsPending] = useState(false)

  const requestedSlug = getSlug(editorSearch)

  // Check if the item exists in the full sidebar list (DM sees all items)
  const itemExists = requestedSlug && allItems.some((i) => i.slug === requestedSlug)

  // Resolve the viewed player's display name
  const viewAsPlayerName = (() => {
    if (!viewAsPlayerId) return undefined
    const member = campaignMembersQuery.data?.find((m) => m._id === viewAsPlayerId)
    if (!member) return undefined
    return (
      member.userProfile.name ||
      (member.userProfile.username ? `@${member.userProfile.username}` : undefined)
    )
  })()

  const handleCreate = async () => {
    if (!campaignId || !requestedSlug || isPending) return

    setIsPending(true)
    try {
      const result = await createItem({
        type: SIDEBAR_ITEM_TYPES.notes,
        campaignId,
        parentId: null,
        name: getDefaultName(SIDEBAR_ITEM_TYPES.notes, null),
      })
      openParentFolders(result.id)
      void navigateToItem(result.slug)
    } catch (error) {
      handleError(error, 'Failed to create note')
    }
    setIsPending(false)
  }

  const getMessage = () => {
    if (itemExists) {
      const target = viewAsPlayerName ?? 'you'
      return `This page isn't shared with ${target}.`
    }
    if (isDm) {
      return "This page doesn't exist."
    }
    return "This page doesn't exist or isn't shared with you."
  }

  return (
    <div className="flex-1 min-h-0 flex items-center justify-center">
      <div className="text-center text-muted-foreground">
        <p>{getMessage()}</p>
        {!itemExists && isDm && requestedSlug && (
          <p className="mt-2">
            <Button variant="link" onClick={handleCreate} disabled={isPending}>
              Create it
            </Button>
          </p>
        )}
      </div>
    </div>
  )
}

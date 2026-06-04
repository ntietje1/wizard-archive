import { Suspense, lazy, useRef, useTransition } from 'react'
import { PERMISSION_LEVEL } from 'shared/permissions/types'
import { SIDEBAR_ITEM_TYPES } from 'shared/sidebar-items/types'
import { TrashPageViewer } from './viewer/trash/trash-page-viewer'
import { CreateNewDashboard } from './create-new-dashboard'
import { LoadingSpinner } from '~/shared/components/loading-spinner'
import { EMPTY_EDITOR_DROP_TYPE } from '~/features/dnd/utils/drop-target-data'
import { getSlug } from '~/features/sidebar/utils/sidebar-item-utils'
import { cn } from '~/features/shadcn/lib/utils'
import { effectiveHasAtLeastPermission } from '~/features/sharing/utils/permission-utils'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { useCurrentItem } from '~/features/sidebar/hooks/useCurrentItem'
import { useDndDropTarget } from '~/features/dnd/hooks/useDndDropTarget'
import { useEditorMode } from '~/features/sidebar/hooks/useEditorMode'
import { useEditorNavigation } from '~/features/sidebar/hooks/useEditorNavigation'
import { useExternalDropTarget } from '~/features/dnd/hooks/useExternalDropTarget'
import { useActiveSidebarItems } from '~/features/sidebar/hooks/useSidebarItems'
import { useSidebarItemAvailabilityState } from '~/features/sidebar/hooks/useSidebarItemAvailabilityState'
import type { SidebarItemAvailabilityState } from '~/features/sidebar/hooks/useSidebarItemAvailabilityState'
import { Button } from '~/features/shadcn/components/button'
import { useDndStore } from '~/features/dnd/stores/dnd-store'
import { useCreateFileSystemItem } from '~/features/filesystem/useCreateFileSystemItem'
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
  const { item, contentItem, editorSearch, isLoading, hasRequestedItem } = useCurrentItem()
  const { campaignActor } = useEditorMode()
  const { itemsMap } = useActiveSidebarItems()
  const requestedSlug = getSlug(editorSearch)

  const canView =
    !!item &&
    effectiveHasAtLeastPermission(item, PERMISSION_LEVEL.VIEW, {
      actor: campaignActor,
      allItemsMap: itemsMap,
    })
  const availabilityState = useSidebarItemAvailabilityState({
    lookup: { kind: 'slug', slug: requestedSlug },
    readableItem: contentItem,
    readableItemLoading: isLoading,
    canView,
    subject: 'page',
    fallbackLabel: 'Page',
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
      return <UnavailableEditorContent state={availabilityState} requestedSlug={requestedSlug} />
    }
    return <EmptyEditorContent />
  }

  if (!contentItem) {
    return <EditorLoading />
  }

  return (
    <Suspense fallback={<EditorLoading />}>
      <SidebarItemEditor item={contentItem} search={editorSearch} />
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

function UnavailableEditorContent({
  state,
  requestedSlug,
}: {
  state: SidebarItemAvailabilityState
  requestedSlug: string | null
}) {
  const { campaignId } = useCampaign()
  const { createItem } = useCreateFileSystemItem()
  const { getDefaultName } = useSidebarValidation()
  const { navigateToItem } = useEditorNavigation()
  const { openParentFolders } = useOpenParentFolders()
  const [isPending, startCreateTransition] = useTransition()

  const handleCreate = () => {
    if (!campaignId || !requestedSlug || isPending) return

    startCreateTransition(async () => {
      try {
        const result = await createItem({
          type: SIDEBAR_ITEM_TYPES.notes,
          parentTarget: { kind: 'direct', parentId: null },
          name: getDefaultName(SIDEBAR_ITEM_TYPES.notes, null),
        })
        openParentFolders(result.id)
        await navigateToItem(result.slug)
      } catch (error) {
        handleError(error, 'Failed to create note')
      }
    })
  }

  // UnavailableEditorContent is only rendered when canView is false; an
  // available state prop here would violate that caller invariant.
  if (state.status === 'available') {
    return null
  }

  return (
    <div className="flex-1 min-h-0 flex items-center justify-center">
      <div className="text-center text-muted-foreground">
        <p>{state.message}</p>
        {state.status === 'not_found' && requestedSlug && (
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

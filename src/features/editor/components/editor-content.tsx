import { Suspense, lazy, useRef } from 'react'
import { PERMISSION_LEVEL } from 'shared/permissions/types'
import { TrashPageViewer } from './viewer/trash/trash-page-viewer'
import { CreateNewDashboard } from './create-new-dashboard'
import { LoadingSpinner } from '~/shared/components/loading-spinner'
import { EMPTY_EDITOR_DROP_TYPE } from '~/features/dnd/utils/drop-target-data'
import { cn } from '~/features/shadcn/lib/utils'
import { effectiveHasAtLeastPermission } from '~/features/sharing/utils/permission-utils'
import { useDndDropTarget } from '~/features/dnd/hooks/useDndDropTarget'
import { useExternalDropTarget } from '~/features/dnd/hooks/useExternalDropTarget'
import type { SidebarItemAvailabilityState } from '~/features/sidebar/hooks/useSidebarItemAvailabilityState'
import { Button } from '~/features/shadcn/components/button'
import { useDndStore } from '~/features/dnd/stores/dnd-store'
import { dropTargetChromeClass } from '~/features/dnd/utils/drop-target-visual-state'
import type { EditorWorkspaceSource } from '../workspace/editor-workspace-source'

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

export function EditorContent({ source }: { source: EditorWorkspaceSource }) {
  const { item, contentItem, editorSearch, isLoading, hasRequestedItem } = source.currentItem
  const { campaignActor } = source.editorMode

  const canView =
    !!item &&
    effectiveHasAtLeastPermission(item, PERMISSION_LEVEL.VIEW, {
      actor: campaignActor,
      allItemsMap: source.filesystem.activeItemsById,
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
      return (
        <UnavailableEditorContent
          state={source.availabilityState}
          requestedSlug={source.requestedSlug}
          isCreatingMissingItem={source.isCreatingMissingRequestedNote}
          onCreateMissingItem={source.createMissingRequestedNote}
        />
      )
    }
    return <EmptyEditorContent campaign={source.campaign} />
  }

  if (!contentItem) {
    return <EditorLoading />
  }

  return (
    <Suspense fallback={<EditorLoading />}>
      <SidebarItemEditor item={contentItem} />
    </Suspense>
  )
}

function EmptyEditorContent({ campaign }: { campaign: EditorWorkspaceSource['campaign'] }) {
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
        isDropTarget && !isFileDragTarget && dropTargetChromeClass('default'),
        isFileDragTarget && dropTargetChromeClass('file'),
      )}
    >
      {!campaign.isCampaignLoaded ? null : campaign.isDm ? (
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
  isCreatingMissingItem,
  onCreateMissingItem,
}: {
  state: SidebarItemAvailabilityState
  requestedSlug: string | null
  isCreatingMissingItem: boolean
  onCreateMissingItem: () => void
}) {
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
            <Button variant="link" onClick={onCreateMissingItem} disabled={isCreatingMissingItem}>
              Create it
            </Button>
          </p>
        )}
      </div>
    </div>
  )
}

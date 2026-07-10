import { Suspense, lazy, use, useRef } from 'react'
import { TrashPageViewer } from '../filesystem/trash/page-viewer'
import { CreateNewDashboard } from '../filesystem/create-new-dashboard'
import { LoadingSpinner } from '@wizard-archive/ui/components/loading-spinner'
import type { ResourceAvailabilityState } from '../filesystem/domain/availability-state'
import { cn } from '@wizard-archive/ui/shadcn/lib/utils'
import { dropTargetChromeClass } from '@wizard-archive/ui/drag-drop/drop-target-visual-state'
import { EMPTY_EDITOR_DROP_TYPE } from '../drag-drop/drop-target-data'
import { resolveExternalFileDropTarget } from '../drag-drop/external-file-drop-target'
import { useDndDropTarget } from '../drag-drop/use-drop-target'
import { useExternalDropTarget } from '../drag-drop/use-external-drop-target'
import { useMergedRef } from '../drag-drop/ref-utils'
import { DndProviderContext } from '../drag-drop/context'
import type { CurrentItemState, WorkspaceNavigation } from './runtime'
import type { WorkspaceViewStateStores } from './runtime-host'
import { createRuntimeCreateItemSource } from '../filesystem/create-item-runtime-source'
import type { RuntimeCreateItemSourceInput } from '../filesystem/create-item-runtime-source'
import { createRuntimeTrashSource } from '../filesystem/trash/runtime-source'
import type { RuntimeTrashSourceInput } from '../filesystem/trash/runtime-source'
import type { SidebarItemContentRuntime } from './sidebar/viewer/content'
import { RequestAccessButton } from '@wizard-archive/ui/components/request-access-button'
import type { FileSystemPermissions } from '../filesystem/permissions'

const EMPTY_WORKSPACE_CONTENT_CLASS = 'flex-1 min-h-0 flex items-center justify-center'

type EmptyWorkspaceRuntimeContentInput = RuntimeCreateItemSourceInput & {
  navigation: RuntimeCreateItemSourceInput['navigation'] & Pick<WorkspaceNavigation, 'current'>
  filesystem: RuntimeCreateItemSourceInput['filesystem'] & {
    permissions: RuntimeCreateItemSourceInput['filesystem']['permissions'] &
      Pick<FileSystemPermissions, 'canCreateItems' | 'canEdit'>
  }
}

export type WorkspaceRuntimeContentRuntime = SidebarItemContentRuntime &
  RuntimeTrashSourceInput &
  EmptyWorkspaceRuntimeContentInput & {
    navigation: SidebarItemContentRuntime['navigation'] &
      RuntimeTrashSourceInput['navigation'] &
      EmptyWorkspaceRuntimeContentInput['navigation']
    filesystem: SidebarItemContentRuntime['filesystem'] &
      RuntimeTrashSourceInput['filesystem'] &
      EmptyWorkspaceRuntimeContentInput['filesystem'] & {
        current: Pick<CurrentItemState, 'availabilityState' | 'contentItem' | 'item'>
      }
  }

const SidebarItemContent = lazy(() =>
  import('./sidebar/viewer/content').then((m) => ({
    default: m.SidebarItemContent,
  })),
)

function WorkspaceRuntimeLoading() {
  return (
    <div className="flex-1 min-h-0 flex items-center justify-center">
      <LoadingSpinner size="lg" />
    </div>
  )
}

export function WorkspaceRuntimeContent({
  runtime,
  viewStateStores,
}: {
  runtime: WorkspaceRuntimeContentRuntime
  viewStateStores: WorkspaceViewStateStores
}) {
  const current = runtime.filesystem.current
  const { item, contentItem } = current
  const availabilityState = current.availabilityState
  const currentNavigation = runtime.navigation.current
  const canView = availabilityState.status === 'available'

  if (availabilityState.status === 'loading') {
    return <WorkspaceRuntimeLoading />
  }

  if (currentNavigation.kind === 'trash' && !item) {
    return <TrashPageViewer source={createRuntimeTrashSource(runtime)} />
  }

  if (!canView) {
    if (currentNavigation.kind === 'resource' || item) {
      return <UnavailableWorkspaceRuntimeContent state={current.availabilityState} />
    }
    return <EmptyWorkspaceRuntimeContent runtime={runtime} />
  }

  if (!contentItem) {
    return <WorkspaceRuntimeLoading />
  }

  return (
    <Suspense fallback={<WorkspaceRuntimeLoading />}>
      <SidebarItemContent item={contentItem} runtime={runtime} viewStateStores={viewStateStores} />
    </Suspense>
  )
}

function EmptyWorkspaceRuntimeContent({ runtime }: { runtime: EmptyWorkspaceRuntimeContentInput }) {
  const ref = useRef<HTMLDivElement>(null)
  const dndContext = use(DndProviderContext)
  const dropData = { type: EMPTY_EDITOR_DROP_TYPE } as const
  const canDropItems = runtime.filesystem.permissions.canEdit && dndContext !== null
  const canAcceptExternalFiles =
    runtime.filesystem.permissions.canCreateItems && dndContext?.canAcceptExternalFiles === true
  const { dropTargetRef, isDropTarget } = useDndDropTarget({
    data: dropData,
    canDrop: canDropItems,
  })
  const { externalDropTargetRef, isFileDropTarget } = useExternalDropTarget({
    data: dropData,
    enabled: canAcceptExternalFiles,
    fileDropTarget: resolveExternalFileDropTarget(dropData),
  })
  const emptyWorkspaceDropTargetRef = useMergedRef(ref, dropTargetRef, externalDropTargetRef)
  const currentNavigation = runtime.navigation.current
  const content =
    currentNavigation.kind === 'create' && runtime.filesystem.permissions.canCreateItems ? (
      <CreateNewDashboard parentId={null} source={createRuntimeCreateItemSource(runtime)} />
    ) : (
      <p className="text-muted-foreground">Select an item from the sidebar to view it.</p>
    )

  if (canDropItems || canAcceptExternalFiles) {
    return (
      <div
        ref={emptyWorkspaceDropTargetRef}
        className={cn(
          EMPTY_WORKSPACE_CONTENT_CLASS,
          isDropTarget && !isFileDropTarget && dropTargetChromeClass('default'),
          isFileDropTarget && dropTargetChromeClass('file'),
        )}
        data-testid="empty-workspace-drop-zone"
      >
        {content}
      </div>
    )
  }

  return <div className={EMPTY_WORKSPACE_CONTENT_CLASS}>{content}</div>
}

function UnavailableWorkspaceRuntimeContent({ state }: { state: ResourceAvailabilityState }) {
  if (state.status === 'available') {
    return null
  }

  return (
    <div className="flex-1 min-h-0 flex items-center justify-center">
      <div className="text-center text-muted-foreground">
        <p>{state.message}</p>
        {state.status === 'not_shared' && (
          <div className="mt-3">
            <RequestAccessButton />
          </div>
        )}
      </div>
    </div>
  )
}

import { useRef } from 'react'
import type { MouseEvent } from 'react'
import { PERMISSION_LEVEL } from '../../../../../shared/permissions/types'
import { MoreVertical, Trash2 } from 'lucide-react'
import { EditableBreadcrumb, SidebarItemBreadcrumb } from './editable-breadcrumb'
import { ShareButton } from './share-button'
import { ViewAsPlayerButton } from './view-as-button'
import { Button } from '@wizard-archive/ui/shadcn/components/button'
import { WorkspaceContextMenu } from '../context-menu/context-menu'
import { VIEW_CONTEXT } from '../view-context'
import { cn } from '@wizard-archive/ui/shadcn/lib/utils'
import { formatRelativeTime } from '@wizard-archive/ui/utils/format-relative-time'
import { EmptyContextMenu } from '../../context-menu/components/empty'
import { TooltipButton } from '@wizard-archive/ui/components/tooltip-button'
import { isOptimisticSidebarItem } from '../items/optimistic'
import { createWorkspaceResource } from '../runtime'
import type { AnyItem, AnyItemWithContent } from '../items'
import type { ContextMenuHostRef } from '../../context-menu/components/host'
import type { ViewContext } from '../menu-context'
import type { FileTopbarSource } from './source'

function TrashTopbarTitle({ itemCount }: { itemCount: number }) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <Trash2 className="size-4 text-muted-foreground shrink-0" />
      <span className="font-medium truncate">Trash</span>
      <span className="text-sm text-muted-foreground shrink-0">
        {`${itemCount} item${itemCount !== 1 ? 's' : ''}`}
      </span>
    </div>
  )
}

function itemTimestampLabel(item: AnyItem | null | undefined) {
  if (!item) return null
  return item.updatedTime
    ? `Edited ${formatRelativeTime(item.updatedTime)}`
    : `Created ${formatRelativeTime(item.createdAt)}`
}

type FileTopbarTitleState =
  | { kind: 'loading' }
  | { kind: 'trash'; itemCount: number }
  | {
      kind: 'pending'
      item: AnyItem
      ancestors: Array<AnyItem>
      navigation: FileTopbarFilesystem['navigation']
    }
  | {
      kind: 'item'
      item: AnyItemWithContent
      canRename: boolean
      isNotShared: boolean
      operations: FileTopbarSource['operations']
      navigation: FileTopbarFilesystem['navigation']
    }
  | {
      kind: 'none'
    }

type FileTopbarSubjectState =
  | { kind: 'empty' }
  | { kind: 'item'; item: AnyItem }
  | { kind: 'pending'; item: AnyItem }
  | { kind: 'trash'; itemCount: number }

type FileTopbarHistoryControl =
  | {
      status: 'enabled'
      onToggle: () => void
    }
  | {
      status: 'hidden'
    }

type FileTopbarFilesystem = FileTopbarSource
type FileTopbarViewAsParticipant = FileTopbarFilesystem['sharing']['viewAsParticipant']
type FileTopbarViewAsParticipantId = Extract<
  FileTopbarViewAsParticipant,
  { status: 'available' }
>['selectedParticipantId']
type TopbarContextMenuState =
  | {
      status: 'available'
      viewContext: ViewContext
      item?: AnyItem
    }
  | {
      status: 'hidden'
    }

function FileTopbarTitle({ title }: { title: FileTopbarTitleState }) {
  const isDimmed = title.kind === 'item' && title.isNotShared

  return (
    <div className={cn('flex-1 min-w-0', isDimmed && 'opacity-50')}>
      {title.kind === 'loading' && <div className="bg-muted rounded-md h-5 w-32 my-0.5" />}
      {title.kind === 'trash' && <TrashTopbarTitle itemCount={title.itemCount} />}
      {title.kind === 'pending' && (
        <SidebarItemBreadcrumb
          item={title.item}
          ancestors={title.ancestors}
          canRename={false}
          onOpenAncestor={(item) => {
            void title.navigation.openItem(createWorkspaceResource(item.id))
          }}
        />
      )}
      {title.kind === 'item' && (
        <EditableBreadcrumb
          key={title.item.id}
          item={title.item}
          canRename={title.canRename && !title.isNotShared}
          showNotSharedTooltip={title.isNotShared}
          onRename={async (item, name) => {
            await title.operations.updateItemMetadata({ item, name })
          }}
          onOpenAncestor={(item) => {
            void title.navigation.openItem(createWorkspaceResource(item.id))
          }}
        />
      )}
    </div>
  )
}

function getViewAsParticipantId(viewAsParticipant: FileTopbarViewAsParticipant) {
  return viewAsParticipant.status === 'available'
    ? viewAsParticipant.selectedParticipantId
    : undefined
}

function canRenameTopbarItem({
  canEdit,
  canMutateItem,
  isPendingItem,
  item,
}: {
  canEdit: boolean
  canMutateItem: FileTopbarFilesystem['permissions']['canMutateItem']
  isPendingItem: boolean
  item: AnyItem | null | undefined
}) {
  return !!item && !isPendingItem && canEdit && canMutateItem(item, PERMISSION_LEVEL.EDIT)
}

function canOpenTopbarHistory({
  canAccessItem,
  history,
  isPendingItem,
  item,
}: {
  canAccessItem: FileTopbarFilesystem['permissions']['canAccessItem']
  history: FileTopbarFilesystem['history']
  isPendingItem: boolean
  item: AnyItem | null | undefined
}) {
  return (
    history.status === 'available' &&
    !!item &&
    !isPendingItem &&
    canAccessItem(item, PERMISSION_LEVEL.EDIT)
  )
}

function isTopbarItemHiddenFromViewedPlayer({
  canAccessItem,
  item,
  viewAsParticipantId,
}: {
  canAccessItem: FileTopbarFilesystem['permissions']['canAccessItem']
  item: AnyItem | null | undefined
  viewAsParticipantId: FileTopbarViewAsParticipantId
}) {
  return Boolean(item && viewAsParticipantId && !canAccessItem(item, PERMISSION_LEVEL.VIEW))
}

function createFileTopbarTitleState({
  canRename,
  getVisibleAncestors,
  isCurrentLoading,
  isNotSharedWithPlayer,
  loadedItem,
  operations,
  navigation,
  subject,
}: {
  canRename: boolean
  getVisibleAncestors: FileTopbarFilesystem['getVisibleAncestors']
  isCurrentLoading: boolean
  isNotSharedWithPlayer: boolean
  loadedItem: AnyItemWithContent | null
  operations: FileTopbarFilesystem['operations']
  navigation: FileTopbarFilesystem['navigation']
  subject: FileTopbarSubjectState
}): FileTopbarTitleState {
  if (isCurrentLoading) return { kind: 'loading' }
  if (subject.kind === 'trash') return { kind: 'trash', itemCount: subject.itemCount }

  if (subject.kind === 'pending') {
    return {
      kind: 'pending',
      item: subject.item,
      ancestors: [...getVisibleAncestors(subject.item.id)],
      navigation,
    }
  }

  if (loadedItem) {
    return {
      kind: 'item',
      item: loadedItem,
      canRename,
      isNotShared: isNotSharedWithPlayer,
      operations,
      navigation,
    }
  }

  return { kind: 'none' }
}

function createTopbarSubjectState({
  currentNavigation,
  isPendingItem,
  item,
  trashItemCount,
}: {
  currentNavigation: FileTopbarFilesystem['navigation']['current']
  isPendingItem: boolean
  item: AnyItem | null | undefined
  trashItemCount: number
}): FileTopbarSubjectState {
  if (currentNavigation.kind === 'trash' && !item) {
    return { kind: 'trash', itemCount: trashItemCount }
  }
  if (!item) return { kind: 'empty' }
  return isPendingItem ? { kind: 'pending', item } : { kind: 'item', item }
}

function createTopbarContextMenuState(subject: FileTopbarSubjectState): TopbarContextMenuState {
  if (subject.kind === 'trash') {
    return { status: 'available', viewContext: VIEW_CONTEXT.TRASH_VIEW }
  }

  return subject.kind === 'item'
    ? { status: 'available', viewContext: VIEW_CONTEXT.TOPBAR, item: subject.item }
    : { status: 'hidden' }
}

function topbarMenuPositionFromClick(event: MouseEvent<HTMLButtonElement>) {
  if (event.detail !== 0 && (event.clientX !== 0 || event.clientY !== 0)) {
    return { x: event.clientX, y: event.clientY }
  }

  const bounds = event.currentTarget.getBoundingClientRect()
  return {
    x: bounds.left + bounds.width / 2,
    y: bounds.bottom,
  }
}

export function FileTopbar({
  historyControl,
  source,
}: {
  historyControl: FileTopbarHistoryControl
  source: FileTopbarSource
}) {
  const topbarContextMenuRef = useRef<ContextMenuHostRef>(null)
  const { availabilityState, item } = source.current
  const {
    getTrashItemCount,
    getVisibleAncestors,
    history,
    permissions: { canAccessItem, canEdit, canMutateItem },
    sharing: { items: sharing, viewAsParticipant },
    navigation,
  } = source
  const viewAsParticipantId = getViewAsParticipantId(viewAsParticipant)

  const isPendingItem = isOptimisticSidebarItem(item)
  const loadedItem: AnyItemWithContent | null =
    item && !isPendingItem ? (item as AnyItemWithContent) : null

  const subject = createTopbarSubjectState({
    currentNavigation: navigation.current,
    isPendingItem,
    item,
    trashItemCount: getTrashItemCount(),
  })

  const canRename = canRenameTopbarItem({ canEdit, canMutateItem, isPendingItem, item })

  const isNotSharedWithPlayer = isTopbarItemHiddenFromViewedPlayer({
    canAccessItem,
    item,
    viewAsParticipantId,
  })
  const canOpenHistory = canOpenTopbarHistory({
    canAccessItem,
    history,
    isPendingItem,
    item,
  })

  const toggleHistory = () => {
    if (!canOpenHistory) return
    if (historyControl.status !== 'enabled') return
    historyControl.onToggle()
  }

  const timestampLabel = itemTimestampLabel(item)
  const title = createFileTopbarTitleState({
    canRename,
    getVisibleAncestors,
    isCurrentLoading: availabilityState.status === 'loading',
    isNotSharedWithPlayer,
    loadedItem,
    operations: source.operations,
    navigation,
    subject,
  })
  const contextMenu = createTopbarContextMenuState(subject)
  const hasContextMenu = contextMenu.status === 'available'
  const moreOptionsButton = (
    <EmptyContextMenu>
      <span className="inline-flex">
        <TooltipButton tooltip="More options" side="bottom">
          <Button
            variant="ghost"
            size="icon"
            aria-label="More options"
            disabled={!hasContextMenu}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              topbarContextMenuRef.current?.open(topbarMenuPositionFromClick(e))
            }}
          >
            <MoreVertical className="size-4" />
          </Button>
        </TooltipButton>
      </span>
    </EmptyContextMenu>
  )
  const topbarSurface = (
    <div className="flex items-center py-0.5 pl-3 pr-1 shrink-0 w-full min-w-0 overflow-hidden gap-4 border-b">
      <div className="flex-1 min-w-0">
        <FileTopbarTitle title={title} />
      </div>
      {historyControl.status === 'enabled' && canOpenHistory && timestampLabel && (
        <Button
          variant="ghost"
          onClick={toggleHistory}
          aria-label={`Toggle history panel, ${timestampLabel}`}
          className="text-xs text-muted-foreground hover:text-foreground h-auto px-1.5 py-0.5 shrink-0"
        >
          {timestampLabel}
        </Button>
      )}
      <div className="flex items-center gap-1 flex-shrink-0">
        <ShareButton
          share={sharing}
          item={item}
          isLoading={availabilityState.status === 'loading'}
        />
        <ViewAsPlayerButton viewAsPlayer={viewAsParticipant} />
        {moreOptionsButton}
      </div>
    </div>
  )

  if (contextMenu.status === 'hidden') {
    return topbarSurface
  }

  return (
    <WorkspaceContextMenu
      ref={topbarContextMenuRef}
      viewContext={contextMenu.viewContext}
      item={contextMenu.item}
      disabled={isPendingItem}
    >
      {topbarSurface}
    </WorkspaceContextMenu>
  )
}

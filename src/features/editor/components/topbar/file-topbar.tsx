import { PERMISSION_LEVEL } from 'shared/permissions/types'
import { Trash2 } from 'lucide-react'
import { EditableBreadcrumb, EditableName, SidebarItemBreadcrumb } from './editable-breadcrumb'
import type { ValidationResult } from 'shared/sidebar-items/name'
import { EditorTopbarSurface } from './editor-topbar-surface'
import { ItemButtonWrapper } from './topbar-item-content/item-button-wrapper'
import { Button } from '~/features/shadcn/components/button'
import { effectiveHasAtLeastPermission } from '~/features/sharing/utils/permission-utils'
import { EditorContextMenu } from '~/features/context-menu/components/editor-context-menu'
import { cn } from '~/features/shadcn/lib/utils'
import { formatRelativeTime } from '~/shared/utils/format-relative-time'
import type { AnySidebarItem, AnySidebarItemWithContent } from 'shared/sidebar-items/model-types'
import type { Id } from 'convex/_generated/dataModel'
import { isOptimisticSidebarItem } from '~/features/filesystem/optimistic-sidebar-items'
import type { EditorWorkspaceSource } from '../../workspace/editor-workspace-source'

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

function EmptyEditorTitle({
  campaignId,
  pendingItemName,
  setPendingItemName,
  validateName,
}: {
  campaignId: Id<'campaigns'> | null | undefined
  pendingItemName: string
  setPendingItemName: (name: string) => void
  validateName: (
    name: string,
    parentId: Id<'sidebarItems'> | null,
    excludeId?: Id<'sidebarItems'>,
  ) => ValidationResult
}) {
  return (
    <EditableName
      initialName={pendingItemName}
      defaultName="Untitled Item"
      onChange={setPendingItemName}
      campaignId={campaignId ?? undefined}
      parentId={null}
      validateName={validateName}
    />
  )
}

function itemTimestampLabel(item: AnySidebarItem | null | undefined) {
  if (!item) return null
  return item.updatedTime
    ? `Edited ${formatRelativeTime(item.updatedTime)}`
    : `Created ${formatRelativeTime(item._creationTime)}`
}

function buildAncestorTrail(
  item: AnySidebarItem,
  itemsMap: ReadonlyMap<Id<'sidebarItems'>, AnySidebarItem>,
) {
  const ancestors: Array<AnySidebarItem> = []
  const seen = new Set<Id<'sidebarItems'>>([item._id])
  let parentId = item.parentId

  while (parentId && !seen.has(parentId)) {
    const parent = itemsMap.get(parentId)
    if (!parent) break
    ancestors.unshift(parent)
    seen.add(parent._id)
    parentId = parent.parentId
  }

  return ancestors
}

type FileTopbarTitleState =
  | { kind: 'loading' }
  | { kind: 'trash'; itemCount: number }
  | {
      kind: 'pending'
      item: AnySidebarItem
      ancestors: Array<AnySidebarItem>
      commands: EditorWorkspaceSource['commands']
    }
  | {
      kind: 'item'
      item: AnySidebarItemWithContent
      canRename: boolean
      isNotShared: boolean
      commands: EditorWorkspaceSource['commands']
    }
  | {
      kind: 'empty'
      campaignId: Id<'campaigns'> | null | undefined
      pendingItemName: string
      setPendingItemName: (name: string) => void
      commands: EditorWorkspaceSource['commands']
    }
  | { kind: 'none' }

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
          onOpenAncestor={title.commands.openItem}
          getAncestorLinkProps={title.commands.getItemLinkProps}
        />
      )}
      {title.kind === 'item' && (
        <EditableBreadcrumb
          key={title.item._id}
          item={title.item}
          canRename={title.canRename && !title.isNotShared}
          showNotSharedTooltip={title.isNotShared}
          onRename={title.commands.renameItem}
          onOpenAncestor={title.commands.openItem}
          getAncestorLinkProps={title.commands.getItemLinkProps}
          validateName={title.commands.validateItemName}
        />
      )}
      {title.kind === 'empty' && (
        <EmptyEditorTitle
          campaignId={title.campaignId}
          pendingItemName={title.pendingItemName}
          setPendingItemName={title.setPendingItemName}
          validateName={title.commands.validateItemName}
        />
      )}
    </div>
  )
}

export function FileTopbar({ source }: { source: EditorWorkspaceSource }) {
  const { canEdit, campaignActor, viewAsPlayerId } = source.editorMode
  const { item, editorSearch, isLoading, hasRequestedItem } = source.currentItem
  const filesystem = source.filesystem
  const permOpts = { actor: campaignActor, allItemsMap: filesystem.activeItemsById }

  const isTrashView = editorSearch.trash === true && !item
  const isPendingItem = isOptimisticSidebarItem(item)
  const loadedItem: AnySidebarItemWithContent | null =
    item && !isPendingItem ? (item as AnySidebarItemWithContent) : null

  const rootTrashedItems = filesystem.trashItems.filter((candidate) => !candidate.parentId)

  const canRename =
    !!item &&
    !isPendingItem &&
    canEdit &&
    effectiveHasAtLeastPermission(item, PERMISSION_LEVEL.FULL_ACCESS, permOpts)

  const isNotSharedWithPlayer = Boolean(
    item && viewAsPlayerId && !effectiveHasAtLeastPermission(item, PERMISSION_LEVEL.VIEW, permOpts),
  )
  const isEmptyEditor = !item && !hasRequestedItem && !isTrashView
  const canOpenHistory =
    !!item && !isPendingItem && effectiveHasAtLeastPermission(item, PERMISSION_LEVEL.EDIT, permOpts)

  const toggleHistory = () => {
    if (!canOpenHistory) return
    source.chrome.topbar.history.toggle()
  }

  const timestampLabel = itemTimestampLabel(item)
  const title: FileTopbarTitleState = (() => {
    if (isLoading) return { kind: 'loading' }
    if (isTrashView) return { kind: 'trash', itemCount: rootTrashedItems.length }
    if (item && isPendingItem) {
      return {
        kind: 'pending',
        item,
        ancestors: buildAncestorTrail(item, filesystem.activeItemsById),
        commands: source.commands,
      }
    }
    if (loadedItem) {
      return {
        kind: 'item',
        item: loadedItem,
        canRename,
        isNotShared: isNotSharedWithPlayer,
        commands: source.commands,
      }
    }
    if (isEmptyEditor) {
      return {
        kind: 'empty',
        campaignId: source.campaign.campaignId,
        pendingItemName: source.pendingItemName,
        setPendingItemName: source.setPendingItemName,
        commands: source.commands,
      }
    }
    return { kind: 'none' }
  })()

  const middleContent = (
    <ItemButtonWrapper chrome={source.chrome.topbar} isTrashView={isTrashView} />
  )

  const topbarSurface = (
    <EditorTopbarSurface
      title={<FileTopbarTitle title={title} />}
      timestampControl={
        timestampLabel && (
          <Button
            variant="ghost"
            onClick={toggleHistory}
            aria-label={`Toggle history panel, ${timestampLabel}`}
            className="text-xs text-muted-foreground hover:text-foreground h-auto px-1.5 py-0.5 shrink-0"
          >
            {timestampLabel}
          </Button>
        )
      }
      middleContent={middleContent}
    />
  )

  if (!source.chrome.topbar.contextMenu.enabled) {
    return topbarSurface
  }

  return (
    <EditorContextMenu
      viewContext="topbar"
      item={item ?? undefined}
      isTrashView={isTrashView}
      disabled={isPendingItem}
    >
      {topbarSurface}
    </EditorContextMenu>
  )
}

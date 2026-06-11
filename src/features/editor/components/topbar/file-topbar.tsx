import { PERMISSION_LEVEL } from 'shared/permissions/types'
import { Trash2 } from 'lucide-react'
import { EditableBreadcrumb, SidebarItemBreadcrumb } from './editable-breadcrumb'
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
      items: EditorWorkspaceSource['items']
      navigation: EditorWorkspaceSource['navigation']
    }
  | {
      kind: 'item'
      item: AnySidebarItemWithContent
      canRename: boolean
      isNotShared: boolean
      items: EditorWorkspaceSource['items']
      navigation: EditorWorkspaceSource['navigation']
    }
  | {
      kind: 'none'
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
          onOpenAncestor={title.navigation.openItem}
          getAncestorLinkProps={title.navigation.getItemLinkProps}
        />
      )}
      {title.kind === 'item' && (
        <EditableBreadcrumb
          key={title.item._id}
          item={title.item}
          canRename={title.canRename && !title.isNotShared}
          showNotSharedTooltip={title.isNotShared}
          onRename={title.items.renameItem}
          onOpenAncestor={title.navigation.openItem}
          getAncestorLinkProps={title.navigation.getItemLinkProps}
          validateName={title.items.validateItemName}
        />
      )}
    </div>
  )
}

export function FileTopbar({
  onToggleHistory,
  source,
}: {
  onToggleHistory: () => void
  source: EditorWorkspaceSource
}) {
  const { canEdit, campaignActor, viewAsPlayerId } = source.permissions
  const { item, editorSearch, isLoading } = source.content.currentItem
  const index = source.index
  const permOpts = { actor: campaignActor, allItemsMap: index.activeItemsById }

  const isTrashView = editorSearch.trash === true && !item
  const isPendingItem = isOptimisticSidebarItem(item)
  const loadedItem: AnySidebarItemWithContent | null =
    item && !isPendingItem ? (item as AnySidebarItemWithContent) : null

  const rootTrashedItems = index.trashItems.filter((candidate) => !candidate.parentId)

  const canRename =
    !!item &&
    !isPendingItem &&
    canEdit &&
    effectiveHasAtLeastPermission(item, PERMISSION_LEVEL.FULL_ACCESS, permOpts)

  const isNotSharedWithPlayer = Boolean(
    item && viewAsPlayerId && !effectiveHasAtLeastPermission(item, PERMISSION_LEVEL.VIEW, permOpts),
  )
  const canOpenHistory =
    !!item && !isPendingItem && effectiveHasAtLeastPermission(item, PERMISSION_LEVEL.EDIT, permOpts)

  const toggleHistory = () => {
    if (!canOpenHistory) return
    onToggleHistory()
  }

  const timestampLabel = itemTimestampLabel(item)
  const title: FileTopbarTitleState = (() => {
    if (isLoading) return { kind: 'loading' }
    if (isTrashView) return { kind: 'trash', itemCount: rootTrashedItems.length }
    if (item && isPendingItem) {
      return {
        kind: 'pending',
        item,
        ancestors: buildAncestorTrail(item, index.activeItemsById),
        items: source.items,
        navigation: source.navigation,
      }
    }
    if (loadedItem) {
      return {
        kind: 'item',
        item: loadedItem,
        canRename,
        isNotShared: isNotSharedWithPlayer,
        items: source.items,
        navigation: source.navigation,
      }
    }
    return { kind: 'none' }
  })()

  const middleContent = (
    <ItemButtonWrapper
      itemActions={source.items.itemActions}
      isTrashView={isTrashView}
      sharing={source.sharing}
      viewAsPlayer={source.permissions.viewAsPlayer}
    />
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

  if (!source.items.itemActions.enabled) {
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

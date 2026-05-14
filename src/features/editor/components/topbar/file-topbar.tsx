import { PERMISSION_LEVEL } from 'convex/permissions/types'
import { Trash2 } from 'lucide-react'
import { EditableBreadcrumb, EditableName, SidebarItemBreadcrumb } from './editable-breadcrumb'
import { EditorViewModeToggleButton } from './topbar-item-content/note-buttons'
import { ItemButtonWrapper } from './topbar-item-content/item-button-wrapper'
import { Button } from '~/features/shadcn/components/button'
import { effectiveHasAtLeastPermission } from '~/features/sharing/utils/permission-utils'
import { useCurrentItem } from '~/features/sidebar/hooks/useCurrentItem'
import { EditorContextMenu } from '~/features/context-menu/components/editor-context-menu'
import { cn } from '~/features/shadcn/lib/utils'
import { useEditorMode } from '~/features/sidebar/hooks/useEditorMode'
import { useSidebarUIStore } from '~/features/sidebar/stores/sidebar-ui-store'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import {
  useActiveSidebarItems,
  useTrashSidebarItems,
} from '~/features/sidebar/hooks/useSidebarItems'
import { RIGHT_SIDEBAR_CONTENT } from '~/features/editor/components/right-sidebar/constants'
import { useRightSidebar } from '~/features/editor/hooks/useRightSidebar'
import { formatRelativeTime } from '~/shared/utils/format-relative-time'
import type { AnySidebarItem, AnySidebarItemWithContent } from 'convex/sidebarItems/types/types'
import type { Id } from 'convex/_generated/dataModel'
import { isOptimisticSidebarItem } from '~/features/filesystem/optimistic-sidebar-items'

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
  setPendingItemName,
}: {
  campaignId: Id<'campaigns'> | null | undefined
  setPendingItemName: (name: string) => void
}) {
  return (
    <EditableName
      initialName=""
      defaultName="Untitled Item"
      onChange={setPendingItemName}
      campaignId={campaignId ?? undefined}
      parentId={null}
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
  | { kind: 'pending'; item: AnySidebarItem; ancestors: Array<AnySidebarItem> }
  | { kind: 'item'; item: AnySidebarItemWithContent; canRename: boolean; isNotShared: boolean }
  | {
      kind: 'empty'
      campaignId: Id<'campaigns'> | null | undefined
      setPendingItemName: (name: string) => void
    }
  | { kind: 'none' }

function FileTopbarTitle({ title }: { title: FileTopbarTitleState }) {
  const isDimmed = title.kind === 'item' && title.isNotShared

  return (
    <div className={cn('flex-1 min-w-0', isDimmed && 'opacity-50')}>
      {title.kind === 'loading' && <div className="bg-muted rounded-md h-5 w-32 my-0.5" />}
      {title.kind === 'trash' && <TrashTopbarTitle itemCount={title.itemCount} />}
      {title.kind === 'pending' && (
        <SidebarItemBreadcrumb item={title.item} ancestors={title.ancestors} canRename={false} />
      )}
      {title.kind === 'item' && (
        <EditableBreadcrumb
          key={title.item._id}
          item={title.item}
          canRename={title.canRename && !title.isNotShared}
          showNotSharedTooltip={title.isNotShared}
        />
      )}
      {title.kind === 'empty' && (
        <EmptyEditorTitle
          campaignId={title.campaignId}
          setPendingItemName={title.setPendingItemName}
        />
      )}
    </div>
  )
}

export function FileTopbar() {
  const { canEdit, viewAsPlayerId } = useEditorMode()
  const { item, editorSearch, isLoading, hasRequestedItem } = useCurrentItem()
  const { itemsMap } = useActiveSidebarItems()
  const setPendingItemName = useSidebarUIStore((s) => s.setPendingItemName)
  const { isDm, campaignId } = useCampaign()
  const permOpts = { isDm, viewAsPlayerId, allItemsMap: itemsMap }

  const isTrashView = editorSearch.trash === true && !item
  const isPendingItem = isOptimisticSidebarItem(item)
  const loadedItem: AnySidebarItemWithContent | null =
    item && !isPendingItem ? (item as AnySidebarItemWithContent) : null

  const { parentItemsMap: trashedParentItemsMap } = useTrashSidebarItems()
  const rootTrashedItems = trashedParentItemsMap.get(null) ?? []

  const canRename =
    !!item &&
    !isPendingItem &&
    canEdit &&
    effectiveHasAtLeastPermission(item, PERMISSION_LEVEL.FULL_ACCESS, permOpts)

  const isNotSharedWithPlayer = Boolean(
    item && viewAsPlayerId && !effectiveHasAtLeastPermission(item, PERMISSION_LEVEL.VIEW, permOpts),
  )
  const isEmptyEditor = !item && !hasRequestedItem && !isTrashView

  const rightSidebar = useRightSidebar()
  const toggleHistory = () => rightSidebar.toggle(RIGHT_SIDEBAR_CONTENT.history)

  const timestampLabel = itemTimestampLabel(item)
  const title: FileTopbarTitleState = (() => {
    if (isLoading) return { kind: 'loading' }
    if (isTrashView) return { kind: 'trash', itemCount: rootTrashedItems.length }
    if (item && isPendingItem) {
      return { kind: 'pending', item, ancestors: buildAncestorTrail(item, itemsMap) }
    }
    if (loadedItem) {
      return { kind: 'item', item: loadedItem, canRename, isNotShared: isNotSharedWithPlayer }
    }
    if (isEmptyEditor) return { kind: 'empty', campaignId, setPendingItemName }
    return { kind: 'none' }
  })()

  const middleContent = (
    <ItemButtonWrapper isTrashView={isTrashView}>
      {canEdit && <EditorViewModeToggleButton disabled={!item} />}
    </ItemButtonWrapper>
  )

  return (
    <EditorContextMenu
      viewContext="topbar"
      item={item ?? undefined}
      isTrashView={isTrashView}
      disabled={isPendingItem}
    >
      <div className="flex items-center py-0.5 pl-3 pr-1 shrink-0 w-full min-w-0 overflow-hidden gap-4 border-b">
        <FileTopbarTitle title={title} />

        {timestampLabel && (
          <Button
            variant="ghost"
            onClick={toggleHistory}
            aria-label={`Toggle history panel, ${timestampLabel}`}
            className="text-xs text-muted-foreground hover:text-foreground h-auto px-1.5 py-0.5 shrink-0"
          >
            {timestampLabel}
          </Button>
        )}

        {middleContent}
      </div>
    </EditorContextMenu>
  )
}

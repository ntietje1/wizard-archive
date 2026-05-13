import { PERMISSION_LEVEL } from 'convex/permissions/types'
import { Trash2 } from 'lucide-react'
import { EditableBreadcrumb, EditableName } from './editable-breadcrumb'
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
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import type { Id } from 'convex/_generated/dataModel'

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

export function FileTopbar() {
  const { canEdit, viewAsPlayerId } = useEditorMode()
  const { item, editorSearch, isLoading, hasRequestedItem } = useCurrentItem()
  const { itemsMap } = useActiveSidebarItems()
  const setPendingItemName = useSidebarUIStore((s) => s.setPendingItemName)
  const { isDm, campaignId } = useCampaign()
  const permOpts = { isDm, viewAsPlayerId, allItemsMap: itemsMap }

  const isTrashView = editorSearch.trash === true && !item

  const { parentItemsMap: trashedParentItemsMap } = useTrashSidebarItems()
  const rootTrashedItems = trashedParentItemsMap.get(null) ?? []

  const canRename =
    !!item && canEdit && effectiveHasAtLeastPermission(item, PERMISSION_LEVEL.FULL_ACCESS, permOpts)

  const isNotSharedWithPlayer =
    item && viewAsPlayerId && !effectiveHasAtLeastPermission(item, PERMISSION_LEVEL.VIEW, permOpts)
  const isEmptyEditor = !item && !hasRequestedItem && !isTrashView

  const rightSidebar = useRightSidebar()
  const toggleHistory = () => rightSidebar.toggle(RIGHT_SIDEBAR_CONTENT.history)

  const timestampLabel = itemTimestampLabel(item)

  const middleContent = (
    <ItemButtonWrapper isTrashView={isTrashView}>
      {canEdit && <EditorViewModeToggleButton disabled={!item} />}
    </ItemButtonWrapper>
  )

  return (
    <EditorContextMenu viewContext="topbar" item={item ?? undefined} isTrashView={isTrashView}>
      <div className="flex items-center py-0.5 pl-3 pr-1 shrink-0 w-full min-w-0 overflow-hidden gap-4 border-b">
        <div className={cn('flex-1 min-w-0', isNotSharedWithPlayer && 'opacity-50')}>
          {isLoading && <div className="bg-muted rounded-md h-5 w-32 my-0.5" />}
          {isTrashView && <TrashTopbarTitle itemCount={rootTrashedItems.length} />}
          {item && (
            <EditableBreadcrumb
              key={item._id}
              item={item}
              canRename={canRename && !isNotSharedWithPlayer}
              showNotSharedTooltip={!!isNotSharedWithPlayer}
            />
          )}
          {isEmptyEditor && (
            <EmptyEditorTitle campaignId={campaignId} setPendingItemName={setPendingItemName} />
          )}
        </div>

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

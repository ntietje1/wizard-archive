import { PERMISSION_LEVEL } from 'convex/permissions/types'
import { SIDEBAR_ITEM_LOCATION } from 'convex/sidebarItems/types/baseTypes'
import { Trash2 } from 'lucide-react'
import { EditableBreadcrumb, EditableName } from './editable-breadcrumb'
import { EditorViewModeToggleButton } from './topbar-item-content/note-buttons'
import { ItemButtonWrapper } from './topbar-item-content/item-button-wrapper'
import { effectiveHasAtLeastPermission } from '~/features/sharing/utils/permission-utils'
import { useCurrentItem } from '~/features/sidebar/hooks/useCurrentItem'
import { EditorContextMenu } from '~/features/context-menu/components/editor-context-menu'
import { cn } from '~/features/shadcn/lib/utils'
import { useEditorMode } from '~/features/sidebar/hooks/useEditorMode'
import { useSidebarUIStore } from '~/features/sidebar/stores/sidebar-ui-store'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import {
  useActiveSidebarItems,
  useSidebarItems,
} from '~/features/sidebar/hooks/useSidebarItems'
import {
  RIGHT_SIDEBAR_CONTENT,
  RIGHT_SIDEBAR_DEFAULTS,
  RIGHT_SIDEBAR_PANEL_ID,
} from '~/features/editor/components/right-sidebar/constants'
import { usePanelPreference } from '~/features/settings/hooks/use-panel-preference'
import { formatRelativeTime } from '~/shared/utils/format-relative-time'

export function FileTopbar() {
  const { canEdit, viewAsPlayerId } = useEditorMode()
  const { item, editorSearch, isLoading, hasRequestedItem } = useCurrentItem()
  const { itemsMap } = useActiveSidebarItems()
  const setPendingItemName = useSidebarUIStore((s) => s.setPendingItemName)
  const { isDm, campaignId } = useCampaign()
  const permOpts = { isDm, viewAsPlayerId, allItemsMap: itemsMap }

  const isTrashView = editorSearch.trash === true && !item

  const { parentItemsMap: trashedParentItemsMap } = useSidebarItems(
    SIDEBAR_ITEM_LOCATION.trash,
  )
  const rootTrashedItems = trashedParentItemsMap.get(null) ?? []

  const canRename =
    !!item &&
    canEdit &&
    effectiveHasAtLeastPermission(item, PERMISSION_LEVEL.FULL_ACCESS, permOpts)

  const isNotSharedWithPlayer =
    item &&
    viewAsPlayerId &&
    !effectiveHasAtLeastPermission(item, PERMISSION_LEVEL.VIEW, permOpts)
  const isEmptyEditor = !item && !hasRequestedItem && !isTrashView

  const rightPanel = usePanelPreference(
    RIGHT_SIDEBAR_PANEL_ID,
    RIGHT_SIDEBAR_DEFAULTS,
  )
  const toggleHistory = () => {
    const isShowingHistory =
      rightPanel.visible &&
      rightPanel.activeContentId === RIGHT_SIDEBAR_CONTENT.history
    if (isShowingHistory) {
      rightPanel.setVisible(false)
    } else {
      rightPanel.setActiveContent(RIGHT_SIDEBAR_CONTENT.history)
      rightPanel.setVisible(true)
    }
  }

  const timestampLabel = item
    ? item.updatedTime
      ? `Edited ${formatRelativeTime(item.updatedTime)}`
      : `Created ${formatRelativeTime(item._creationTime)}`
    : null

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
    >
      <div className="flex items-center py-0.5 pl-3 pr-1 shrink-0 w-full min-w-0 overflow-hidden gap-4 border-b">
        <div
          className={cn(
            'flex-1 min-w-0',
            isNotSharedWithPlayer && 'opacity-50',
          )}
        >
          {isLoading && <div className="bg-muted rounded-md h-5 w-32 my-0.5" />}
          {isTrashView && (
            <div className="flex items-center gap-2 min-w-0">
              <Trash2 className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="font-medium truncate">Trash</span>
              <span className="text-sm text-muted-foreground shrink-0">
                {`${rootTrashedItems.length} item${rootTrashedItems.length !== 1 ? 's' : ''}`}
              </span>
            </div>
          )}
          {item && (
            <EditableBreadcrumb
              key={item._id}
              item={item}
              canRename={canRename && !isNotSharedWithPlayer}
              showNotSharedTooltip={!!isNotSharedWithPlayer}
            />
          )}
          {isEmptyEditor && (
            <EditableName
              initialName=""
              defaultName="Untitled Item"
              onChange={setPendingItemName}
              campaignId={campaignId}
              parentId={null}
            />
          )}
        </div>

        {timestampLabel && (
          <button
            type="button"
            onClick={toggleHistory}
            className="text-xs text-muted-foreground hover:text-foreground focus-visible:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring transition-colors shrink-0"
          >
            {timestampLabel}
          </button>
        )}

        {middleContent}
      </div>
    </EditorContextMenu>
  )
}

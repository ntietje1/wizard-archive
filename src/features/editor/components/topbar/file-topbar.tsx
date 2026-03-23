import { PERMISSION_LEVEL } from 'convex/permissions/types'
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
  useAllSidebarItems,
  useTrashedSidebarItems,
} from '~/features/sidebar/hooks/useSidebarItems'

export function FileTopbar() {
  const { canEdit, viewAsPlayerId } = useEditorMode()
  const { item, editorSearch, isLoading, hasRequestedItem } = useCurrentItem()
  const { itemsMap } = useAllSidebarItems()
  const setPendingItemName = useSidebarUIStore((s) => s.setPendingItemName)
  const { isDm, campaignId } = useCampaign()
  const permOpts = { isDm, viewAsPlayerId, allItemsMap: itemsMap }

  const isTrashView = editorSearch.trash === true && !item

  const { parentItemsMap: trashedParentItemsMap } = useTrashedSidebarItems()
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
      <div className="flex items-center px-4 pt-1 h-10 shrink-0 w-full min-w-0 overflow-hidden gap-4">
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

        {middleContent}
      </div>
    </EditorContextMenu>
  )
}

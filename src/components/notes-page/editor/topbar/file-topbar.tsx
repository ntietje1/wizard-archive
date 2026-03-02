import { useCallback } from 'react'
import { PERMISSION_LEVEL } from 'convex/permissions/types'
import { EditableBreadcrumb } from './editable-breadcrumb'
import { EditorViewModeToggleButton } from './topbar-item-content.tsx/note-buttons'
import { ItemButtonWrapper } from './topbar-item-content.tsx/item-button-wrapper'
import { effectiveHasAtLeastPermission } from '~/lib/permission-utils'
import { useLastEditorItem } from '~/hooks/useLastEditorItem'
import { useCurrentItem } from '~/hooks/useCurrentItem'
import { useRenameItem } from '~/hooks/useRenameItem'
import { Skeleton } from '~/components/shadcn/ui/skeleton'
import { EditorContextMenu } from '~/components/context-menu/components/EditorContextMenu'
import { cn } from '~/lib/shadcn/utils'
import { useEditorMode } from '~/hooks/useEditorMode'
import { useSidebarUIStore } from '~/stores/sidebarUIStore'
import { useCampaign } from '~/hooks/useCampaign'
import { useAllSidebarItems } from '~/hooks/useSidebarItems'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'

export function FileTopbar() {
  const { canEdit, viewAsPlayerId } = useEditorMode()
  const { item, isLoading, hasRequestedItem } = useCurrentItem()
  const { itemsMap } = useAllSidebarItems()
  const { setLastSelectedItem } = useLastEditorItem()
  const { rename } = useRenameItem()
  const setPendingItemName = useSidebarUIStore((s) => s.setPendingItemName)
  const { isDm, campaignId, dmUsername, campaignSlug } = useCampaign()
  const permOpts = { isDm, viewAsPlayerId, allItemsMap: itemsMap }

  const routeParams = { dmUsername, campaignSlug }

  const canRename =
    item &&
    effectiveHasAtLeastPermission(item, PERMISSION_LEVEL.FULL_ACCESS, permOpts)

  const handleRename = async (newName: string) => {
    if (!item) return
    await rename(item, newName)
  }

  const handleNavigateToItem = useCallback(
    (ancestor: AnySidebarItem) => {
      setLastSelectedItem({ type: ancestor.type, slug: ancestor.slug })
    },
    [setLastSelectedItem],
  )

  const isNotSharedWithPlayer =
    item &&
    viewAsPlayerId &&
    !effectiveHasAtLeastPermission(item, PERMISSION_LEVEL.VIEW, permOpts)
  const isEmptyEditor = !item && !hasRequestedItem

  const middleContent = (
    <ItemButtonWrapper>
      {canEdit && <EditorViewModeToggleButton disabled={!item} />}
    </ItemButtonWrapper>
  )

  return (
    <EditorContextMenu viewContext="topbar" item={item ?? undefined}>
      <div className="flex items-center px-4 pt-1 h-10 shrink-0 w-full min-w-0 overflow-hidden gap-4">
        <div
          className={cn(
            'flex-1 min-w-0',
            isNotSharedWithPlayer && 'opacity-50',
          )}
        >
          {isLoading && <Skeleton className="h-5 w-32 my-0.5" />}
          {item && (
            <EditableBreadcrumb
              initialName={item.name}
              defaultName=""
              onRename={handleRename}
              ancestors={item.ancestors}
              onNavigateToItem={handleNavigateToItem}
              routeParams={routeParams}
              campaignId={item.campaignId}
              parentId={item.parentId ?? undefined}
              excludeId={item._id}
              disabled={!canRename || (isNotSharedWithPlayer ?? false)}
              showNotSharedTooltip={!!isNotSharedWithPlayer}
            />
          )}
          {isEmptyEditor && (
            <EditableBreadcrumb
              initialName=""
              defaultName="Untitled Item"
              onRename={handleRename}
              onChange={setPendingItemName}
              ancestors={[]}
              routeParams={routeParams}
              campaignId={campaignId}
            />
          )}
        </div>

        {middleContent}
      </div>
    </EditorContextMenu>
  )
}

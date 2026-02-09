import { hasAtLeastPermissionLevel } from 'convex/shares/itemShares'
import { PERMISSION_LEVEL } from 'convex/shares/types'
import { defaultItemName } from 'convex/sidebarItems/sidebarItems'
import { EditableBreadcrumb } from './editable-breadcrumb'
import { EditorViewModeToggleButton } from './topbar-item-content.tsx/note-buttons'
import { ItemButtonWrapper } from './topbar-item-content.tsx/item-button-wrapper'
import { useEditorNavigation } from '~/hooks/useEditorNavigation'
import { useCurrentItem } from '~/hooks/useCurrentItem'
import { useRenameItem } from '~/hooks/useRenameItem'
import { Skeleton } from '~/components/shadcn/ui/skeleton'
import { EditorContextMenu } from '~/components/context-menu/components/EditorContextMenu'
import { cn } from '~/lib/shadcn/utils'
import { useEditorModeState } from '~/hooks/useEditorMode'

export function FileTopbar() {
  const { canEdit, viewAsPlayerId } = useEditorModeState()
  const { item, isLoading } = useCurrentItem()
  const { item: viewAsItem } = useCurrentItem(viewAsPlayerId)
  const { navigateToItem } = useEditorNavigation()
  const { rename } = useRenameItem()
  const canRename =
    item &&
    hasAtLeastPermissionLevel(
      item.myPermissionLevel,
      PERMISSION_LEVEL.FULL_ACCESS,
    )

  const handleRename = async (newName: string) => {
    if (!item) return
    await rename(item, newName)
  }

  const defaultName = defaultItemName(item)
  const isNotSharedWithPlayer = item && !viewAsItem

  if (isLoading) {
    return <TopbarLoading />
  }

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
          {item && (
            <EditableBreadcrumb
              initialName={item.name || ''}
              defaultName={defaultName}
              onRename={handleRename}
              ancestors={item.ancestors}
              onNavigateToItem={navigateToItem}
              campaignId={item.campaignId}
              parentId={item.parentId}
              excludeId={item._id}
              disabled={!canRename || (isNotSharedWithPlayer ?? false)}
              showNotSharedTooltip={!!isNotSharedWithPlayer}
            />
          )}
        </div>

        {middleContent}
      </div>
    </EditorContextMenu>
  )
}

function TopbarLoading() {
  return (
    <div className="p-2 h-12 shrink-0">
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-32" />
        <div className="flex items-center space-x-2">
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-8" />
        </div>
      </div>
    </div>
  )
}

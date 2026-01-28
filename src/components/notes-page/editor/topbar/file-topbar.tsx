import { defaultItemName } from 'convex/sidebarItems/sidebarItems'
import { EditableBreadcrumb } from './editable-breadcrumb'
import { EditorViewModeToggleButton } from './topbar-item-content.tsx/note-buttons'
import { ItemButtonWrapper } from './topbar-item-content.tsx/item-button-wrapper'
import { useEditorNavigation } from '~/hooks/useEditorNavigation'
import { useCurrentItem } from '~/hooks/useCurrentItem'
import { useRenameItem } from '~/hooks/useRenameItem'
import { Skeleton } from '~/components/shadcn/ui/skeleton'
import { EditorContextMenu } from '~/components/context-menu/components/EditorContextMenu'
import { isNote } from '~/lib/sidebar-item-utils'
import { cn } from '~/lib/shadcn/utils'

export function FileTopbar() {
  const { item, itemForDm, isLoading } = useCurrentItem()
  const { navigateToItem } = useEditorNavigation()
  const { rename } = useRenameItem()

  const handleRename = async (newName: string) => {
    if (!item) return
    await rename(item, newName)
  }

  const defaultName = defaultItemName(itemForDm)
  const isNotSharedWithPlayer = itemForDm && !item

  if (isLoading) {
    return <TopbarLoading />
  }

  const middleContent = (
    <ItemButtonWrapper>
      {itemForDm && isNote(itemForDm) && (
        <EditorViewModeToggleButton disabled={!item} />
      )}
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
          {itemForDm && (
            <EditableBreadcrumb
              initialName={itemForDm.name || ''}
              defaultName={defaultName || 'Untitled'}
              onRename={handleRename}
              ancestors={itemForDm.ancestors}
              onNavigateToItem={navigateToItem}
              campaignId={itemForDm.campaignId}
              parentId={itemForDm.parentId}
              excludeId={itemForDm._id}
              disabled={isNotSharedWithPlayer ?? false}
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

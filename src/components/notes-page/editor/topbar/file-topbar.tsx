import { defaultItemName } from 'convex/sidebarItems/sidebarItems'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import { EditableBreadcrumb } from './editable-breadcrumb'
import { NoteButtons } from './topbar-item-content.tsx/note-buttons'
import { ItemButtonWrapper } from './topbar-item-content.tsx/item-button-wrapper'
import { useEditorNavigation } from '~/hooks/useEditorNavigation'
import { useCurrentItem } from '~/hooks/useCurrentItem'
import { useRenameItem } from '~/hooks/useRenameItem'
import { Skeleton } from '~/components/shadcn/ui/skeleton'
import { EditorContextMenu } from '~/components/context-menu/components/EditorContextMenu'
import { isNote } from '~/lib/sidebar-item-utils'

export function FileTopbar() {
  const { item, isLoading } = useCurrentItem()
  const { navigateToItem } = useEditorNavigation()
  const { rename } = useRenameItem()

  const handleRename = async (newName: string) => {
    if (!item) return
    await rename(item, newName)
  }

  const ancestors = useQuery(
    convexQuery(
      api.sidebarItems.queries.getSidebarItemAncestors,
      item
        ? {
            campaignId: item.campaignId,
            id: item._id,
          }
        : 'skip',
    ),
  )

  const defaultName = defaultItemName(item)

  if (isLoading) {
    return <TopbarLoading />
  }

  if (!item) {
    return <TopbarEmpty />
  }

  // Determine middle content based on item type
  const middleContent = isNote(item) ? (
    <>
      <NoteButtons />
    </>
  ) : (
    <ItemButtonWrapper />
  )

  return (
    <EditorContextMenu viewContext="topbar" item={item}>
      <div className="flex items-center px-4 pt-1 h-10 shrink-0 w-full min-w-0 overflow-hidden gap-4">
        {/* Left section: Breadcrumb */}
        <div className="flex-1 min-w-0">
          <EditableBreadcrumb
            initialName={item.name || ''}
            defaultName={defaultName || 'Untitled'}
            onRename={handleRename}
            ancestors={ancestors.data ?? []}
            onNavigateToItem={navigateToItem}
            campaignId={item.campaignId}
            parentId={item.parentId}
            excludeId={item._id}
          />
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

function TopbarEmpty() {
  return (
    <div className="flex items-center justify-between px-4 py-2 h-12 shrink-0 w-full min-w-0 max-w-full overflow-hidden">
      <div className="flex items-center justify-between w-full h-12" />
    </div>
  )
}

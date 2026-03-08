import { PERMISSION_LEVEL } from 'convex/permissions/types'
import { hasAtLeastPermissionLevel } from 'convex/permissions/hasAtLeastPermissionLevel'
import { ItemCard } from './item-card'
import { NewItemCard } from './new-item-card'
import { DroppableFolderZone } from './droppable-folder-zone'
import type { EditorViewerProps } from '../sidebar-item-editor'
import type { FolderWithContent } from 'convex/folders/types'
import { CreateNewDashboard } from '~/components/notes-page/editor/create-new-dashboard'
import {
  useFilteredSidebarItems,
  useTrashedSidebarItems,
} from '~/hooks/useSidebarItems'
import { ContentGrid } from '~/components/content-grid-page/content-grid'
import { ScrollArea } from '~/components/shadcn/ui/scroll-area'
import { LoadingSpinner } from '~/components/loading/loading-spinner'
import { EditorContextMenu } from '~/components/context-menu/components/EditorContextMenu'

export function FolderViewer({
  item: folder,
}: EditorViewerProps<FolderWithContent>) {
  const { parentItemsMap, status } = useFilteredSidebarItems()
  const { parentItemsMap: trashedParentItemsMap, status: trashedStatus } =
    useTrashedSidebarItems()

  const isDeleted = !!folder.deletionTime
  const effectiveStatus = isDeleted ? trashedStatus : status
  const children = isDeleted
    ? (trashedParentItemsMap.get(folder._id) ?? [])
    : (parentItemsMap.get(folder._id) ?? [])

  const hasFullAccess =
    !isDeleted &&
    hasAtLeastPermissionLevel(
      folder.myPermissionLevel,
      PERMISSION_LEVEL.FULL_ACCESS,
    )

  const folderPath = [...folder.ancestors.map((a) => a.name), folder.name].join(
    ' / ',
  )

  if (effectiveStatus === 'pending') {
    return (
      <div className="flex-1 min-h-0 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (children.length === 0) {
    return (
      <EditorContextMenu
        viewContext="folder-view"
        className="flex flex-col h-full w-full min-h-0"
        item={folder}
      >
        <DroppableFolderZone
          folder={folder}
          className="flex flex-col h-full w-full min-h-0"
        >
          {hasFullAccess ? (
            <CreateNewDashboard parentId={folder._id} folderPath={folderPath} />
          ) : (
            <div className="flex-1 min-h-0 flex items-center justify-center">
              <p className="text-muted-foreground">This folder is empty.</p>
            </div>
          )}
        </DroppableFolderZone>
      </EditorContextMenu>
    )
  }

  return (
    <EditorContextMenu
      viewContext="folder-view"
      className="flex flex-col h-full w-full min-h-0"
      item={folder}
    >
      <DroppableFolderZone
        folder={folder}
        className="flex flex-col h-full w-full min-h-0"
      >
        <ScrollArea className="flex-1 min-h-0">
          <div className="w-full min-w-0">
            <ContentGrid className="p-6 min-h-0">
              {children.map((childItem) => {
                return (
                  <ItemCard
                    key={childItem._id}
                    item={childItem}
                    parentId={folder._id}
                  />
                )
              })}
              {hasFullAccess && <NewItemCard parentId={folder._id} />}
            </ContentGrid>
          </div>
        </ScrollArea>
      </DroppableFolderZone>
    </EditorContextMenu>
  )
}

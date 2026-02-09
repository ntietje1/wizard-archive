import { ItemCard } from './item-card'
import { NewItemCard } from './new-item-card'
import { DroppableFolderZone } from './droppable-folder-zone'
import { CreateNewDashboard } from '~/components/notes-page/editor/create-new-dashboard'
import { defaultItemName } from 'convex/sidebarItems/sidebarItems'
import type { ReactNode } from 'react'
import type { EditorViewerProps } from '../sidebar-item-editor'
import type { FolderWithContent } from 'convex/folders/types'
import { ContentGrid } from '~/components/content-grid-page/content-grid'
import { ScrollArea } from '~/components/shadcn/ui/scroll-area'
import { EditorContextMenu } from '~/components/context-menu/components/EditorContextMenu'

export function FolderViewer({
  item: folder,
}: EditorViewerProps<FolderWithContent>) {
  const folderPath = [
    ...folder.ancestors.map((a) => a.name || defaultItemName(a)),
    folder.name || defaultItemName(folder),
  ].join(' / ')

  const Wrapper: React.FC<{ children: ReactNode }> = ({ children }) => {
    return (
      <EditorContextMenu
        viewContext="folder-view"
        className="flex flex-col h-full w-full min-h-0"
        item={folder}
      >
        <DroppableFolderZone
          folder={folder}
          className="flex flex-col h-full w-full min-h-0"
          highlightClassName="bg-muted/50"
        >
          {children}
        </DroppableFolderZone>
      </EditorContextMenu>
    )
  }

  if (folder.children.length === 0) {
    return (
      <Wrapper>
        <CreateNewDashboard parentId={folder._id} folderPath={folderPath} />
      </Wrapper>
    )
  }

  return (
    <Wrapper>
      <ScrollArea className="flex-1 min-h-0">
        <div className="w-full min-w-0">
          <ContentGrid className="p-6 min-h-0">
            {folder.children.map((childItem) => {
              return (
                <ItemCard
                  key={childItem._id}
                  item={childItem}
                  parentId={folder._id}
                />
              )
            })}
            <NewItemCard parentId={folder._id} />
          </ContentGrid>
        </div>
      </ScrollArea>
    </Wrapper>
  )
}

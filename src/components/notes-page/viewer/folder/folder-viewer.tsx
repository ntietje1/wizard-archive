import { ItemCard } from './item-card'
import { DroppableFolderZone } from './droppable-folder-zone'
import type { ReactNode } from 'react'
import type { EditorViewerProps } from '../sidebar-item-editor'
import type { Folder } from 'convex/folders/types'
import { useFolderView } from '~/hooks/useFolderView'
import { ContentGrid } from '~/components/content-grid-page/content-grid'
import { ScrollArea } from '~/components/shadcn/ui/scroll-area'
import { LoadingSpinner } from '~/components/loading/loading-spinner'
import { EditorContextMenu } from '~/components/context-menu/components/EditorContextMenu'

export function FolderViewer({ item: folder }: EditorViewerProps<Folder>) {
  const { items, isLoading } = useFolderView({
    parentItem: folder,
  })

  if (isLoading) {
    // TODO: improve loading state
    return (
      <div className="h-full flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

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

  if (items.length === 0) {
    return (
      <Wrapper>
        <div className="h-full flex items-center justify-center text-muted-foreground">
          This folder has no items.
        </div>
      </Wrapper>
    )
  }

  return (
    <Wrapper>
      <ScrollArea className="flex-1 w-full overflow-x-hidden">
        <div className="w-full min-w-0">
          <ContentGrid className="p-6 min-h-0">
            {items.map((childItem) => {
              return (
                <ItemCard
                  key={childItem._id}
                  item={childItem}
                  parentId={folder._id}
                />
              )
            })}
          </ContentGrid>
        </div>
      </ScrollArea>
    </Wrapper>
  )
}

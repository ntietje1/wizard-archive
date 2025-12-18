import type { ReactNode } from 'react'
import type { EditorViewerProps } from '~/lib/editor-registry'
import { useFolderView } from '~/hooks/useFolderView'
import { ContentGrid } from '~/components/content-grid-page/content-grid'
import { ScrollArea } from '~/components/shadcn/ui/scroll-area'
import { PageEditorSkeleton } from '../page-editor-wrapper'
import { SidebarItemContextMenu } from '~/components/context-menu/sidebar/SidebarItemContextMenu'
import type { Folder } from 'convex/folders/types'
import { ItemCard } from './item-card'

export function FolderViewer({ item: folder }: EditorViewerProps<Folder>) {
  const { items, isLoading, category } = useFolderView({
    parentItem: folder,
  })

  if (isLoading) {
    //TODO: improve loading state
    return <PageEditorSkeleton />
  }

  const Wrapper: React.FC<{ children: ReactNode }> = ({ children }) => {
    return (
      <SidebarItemContextMenu
        className="h-full w-full"
        item={folder}
        viewContext="folder-view"
        category={category}
      >
        {children}
      </SidebarItemContextMenu>
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
      <ScrollArea className="flex flex-1 min-h-0">
        <ContentGrid className="p-6">
          {items.map((childItem) => {
            return (
              <ItemCard
                key={childItem._id}
                item={childItem}
                category={category}
              />
            )
          })}
        </ContentGrid>
      </ScrollArea>
    </Wrapper>
  )
}

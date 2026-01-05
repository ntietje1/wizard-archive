import { PageEditorSkeleton } from '../page-editor-wrapper'
import { TagCard } from '../folder/tag-card'
import type { ReactNode } from 'react'
import type { EditorViewerProps } from '~/lib/editor-registry'
import type { TagCategory } from 'convex/tags/types'
import { useTagsByCategory } from '~/hooks/useTagsByCategory'
import { ContentGrid } from '~/components/content-grid-page/content-grid'
import { ScrollArea } from '~/components/shadcn/ui/scroll-area'
import { FolderViewContextMenu } from '~/components/context-menu/folder-view/FolderViewContextMenu'
import { isTagCategory } from '~/lib/sidebar-item-utils'

export function CategoryViewer({
  item: category,
}: EditorViewerProps<TagCategory>) {
  const { data: tags, isLoading } = useTagsByCategory(category._id)

  if (isLoading) {
    // TODO: improve loading state
    return <PageEditorSkeleton />
  }

  if (!isTagCategory(category)) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        Invalid item type for category viewer.
      </div>
    )
  }

  const Wrapper: React.FC<{ children: ReactNode }> = ({ children }) => {
    return (
      <FolderViewContextMenu
        className="h-full w-full"
        item={category}
        category={category}
      >
        {children}
      </FolderViewContextMenu>
    )
  }

  if (!tags || tags.length === 0) {
    return (
      <Wrapper>
        <div className="h-full flex items-center justify-center text-muted-foreground">
          This category has no tags.
        </div>
      </Wrapper>
    )
  }

  return (
    <Wrapper>
      <ScrollArea className="flex flex-1 min-h-0">
        <ContentGrid className="p-6">
          {tags.map((tag) => {
            return <TagCard key={tag._id} item={tag} category={category} />
          })}
        </ContentGrid>
      </ScrollArea>
    </Wrapper>
  )
}

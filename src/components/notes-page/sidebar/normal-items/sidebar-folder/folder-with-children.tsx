import {
  Collapsible,
  CollapsibleContent,
} from '~/components/shadcn/ui/collapsible'
import { DroppableFolder } from './droppable-folder'
import { FolderButton } from './folder-button'
import type { Folder } from 'convex/notes/types'
import { SidebarItem } from '../../sidebar-item/sidebar-item'
import { useFolderState } from '~/hooks/useFolderState'
import type { Id } from 'convex/_generated/dataModel'
import { useSidebarItemsByParent } from '~/hooks/useSidebarItems'

interface FolderWithChildrenProps {
  folder: Folder
  ancestorIds?: Id<'folders'>[]
}

export function FolderWithChildren({
  folder,
  ancestorIds = [],
}: FolderWithChildrenProps) {
  const { isExpanded, toggleExpanded } = useFolderState(folder._id)
  const children = useSidebarItemsByParent(folder.categoryId, folder._id)
  const hasChildren = (children.data && children.data.length > 0) || false

  const currentAncestors: Id<'folders'>[] = [...ancestorIds, folder._id]

  return (
    <DroppableFolder folder={folder} ancestorIds={ancestorIds}>
      <Collapsible open={isExpanded} onOpenChange={toggleExpanded}>
        <FolderButton folder={folder} ancestorIds={ancestorIds} />
        <CollapsibleContent>
          <div className="relative pl-2">
            {/* Vertical line */}
            {hasChildren && (
              <div className="absolute left-1 top-0 bottom-0 w-px bg-muted-foreground/5" />
            )}
            {children.data?.map((item) => (
              <SidebarItem
                key={item._id}
                item={item}
                ancestorIds={currentAncestors}
              />
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </DroppableFolder>
  )
}

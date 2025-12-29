import { useDraggable } from '@dnd-kit/core'
import { SIDEBAR_ITEM_TYPES } from 'convex/sidebarItems/types'
import { defaultItemName } from 'convex/sidebarItems/sidebarItems'
import type { SidebarDragData } from '~/lib/dnd-utils'
import type { ItemCardProps } from './item-card'
import type { Note } from 'convex/notes/types'
import { useFileSidebar } from '~/hooks/useFileSidebar'
import { Card, CardTitle } from '~/components/shadcn/ui/card'
import { Skeleton } from '~/components/shadcn/ui/skeleton'
import { FileText } from '~/lib/icons'
import { useEditorNavigation } from '~/hooks/useEditorNavigation'
import { SidebarItemContextMenu } from '~/components/context-menu/sidebar/SidebarItemContextMenu'

export function NoteCard({
  item: note,
  category,
  onClick,
  isLoading,
}: ItemCardProps<Note>) {
  const { navigateToNote } = useEditorNavigation()
  const { activeDragItem } = useFileSidebar()
  const isDisabled = activeDragItem !== null

  const dragData: SidebarDragData = {
    _id: note._id,
    type: SIDEBAR_ITEM_TYPES.notes,
    name: note.name || defaultItemName(note),
    parentId: note.parentId,
    categoryId: note.categoryId,
    icon: FileText,
  }

  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({
    id: note._id,
    data: dragData,
    disabled: isDisabled,
  })

  const handleCardActivate = () => {
    if (!isDragging) {
      if (onClick) {
        onClick()
      } else if (note.slug) {
        navigateToNote(note.slug)
      }
    }
  }

  if (isLoading) {
    return (
      <Card className="bg-white border border-slate-200 w-full flex flex-row flex-nowrap items-stretch gap-4 p-3 relative rounded-md">
        <div className="flex-1 min-w-0 flex flex-col justify-between">
          <div className="overflow-hidden">
            <div className="flex items-center gap-2 mb-2 min-w-0">
              <Skeleton className="w-6 h-6 rounded-full flex-shrink-0" />
              <Skeleton className="h-6 w-32" />
            </div>
          </div>
        </div>
      </Card>
    )
  }

  const cardContent = (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={isDragging ? 'opacity-50' : ''}
    >
      <Card
        className="bg-white border border-slate-200 w-full cursor-pointer transition-all hover:shadow-md group flex flex-row flex-nowrap items-stretch gap-4 p-3 relative rounded-md"
        onClick={handleCardActivate}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            handleCardActivate()
          }
        }}
        tabIndex={0}
        role="button"
      >
        <div className="flex-1 min-w-0 flex flex-col justify-between">
          <div className="overflow-hidden">
            <div className="flex items-center gap-2 mb-2 min-w-0">
              <FileText className="w-6 h-6 text-slate-600 select-none flex-shrink-0" />
              <CardTitle className="text-xl text-slate-800 truncate select-none">
                {note.name || defaultItemName(note)}
              </CardTitle>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )

  return (
    <SidebarItemContextMenu
      item={note}
      viewContext="folder-view"
      category={category}
    >
      {cardContent}
    </SidebarItemContextMenu>
  )
}

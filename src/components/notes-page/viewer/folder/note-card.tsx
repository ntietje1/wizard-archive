import { ClientOnly } from '@tanstack/react-router'
import { useDraggable } from '@dnd-kit/core'
import { defaultItemName } from 'convex/sidebarItems/sidebarItems'
import { PERMISSION_LEVEL } from 'convex/shares/types'
import { hasAtLeastPermissionLevel } from 'convex/shares/itemShares'
import type { SidebarDragData } from '~/lib/dnd-utils'
import type { ItemCardProps } from './item-card'
import type { Note } from 'convex/notes/types'
import { useFileSidebar } from '~/hooks/useFileSidebar'
import { Card, CardTitle } from '~/components/shadcn/ui/card'
import { Skeleton } from '~/components/shadcn/ui/skeleton'
import { Button } from '~/components/shadcn/ui/button'
import { FileText, MoreVertical } from '~/lib/icons'
import { useEditorNavigation } from '~/hooks/useEditorNavigation'
import { useContextMenu } from '~/hooks/useContextMenu'
import { EditorContextMenu } from '~/components/context-menu/components/EditorContextMenu'

function NoteCardSkeleton() {
  return (
    <div className="w-full h-[140px]">
      <Card className="w-full h-full flex flex-row flex-nowrap items-stretch gap-4 p-2 relative rounded-md">
        <div className="flex-1 min-w-0 flex flex-col justify-between">
          <div className="overflow-hidden">
            <div className="flex items-center gap-2 mb-2 min-w-0">
              <Skeleton className="h-5 w-32" />
            </div>
          </div>
        </div>
        <Skeleton className="w-24 aspect-[5/6] flex-shrink-0 rounded-sm" />
      </Card>
    </div>
  )
}

function NoteCardInner({ item: note, onClick }: ItemCardProps<Note>) {
  const { navigateToNote } = useEditorNavigation()
  const { activeDragItem } = useFileSidebar()
  const canDrag = hasAtLeastPermissionLevel(
    note.myPermissionLevel,
    PERMISSION_LEVEL.FULL_ACCESS,
  )
  const isDisabled = activeDragItem !== null || !canDrag
  const { contextMenuRef, handleMoreOptions } = useContextMenu()

  const dragData: SidebarDragData = note

  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({
    id: `card-${note._id}`,
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

  const cardContent = (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`w-full h-[140px] ${isDragging ? 'opacity-50' : ''}`}
    >
      <Card
        className="w-full h-full cursor-pointer transition-all hover:shadow-md group flex flex-row flex-nowrap items-stretch gap-4 p-2 relative rounded-md"
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
        {/* Left Content Section */}
        <div className="p-1 flex-1 min-w-0 flex flex-col justify-between">
          <div className="overflow-hidden">
            <div className="flex items-center gap-2 mb-2 min-w-0">
              <CardTitle className="text-sm font-medium text-slate-800 truncate select-none flex-1 min-w-0">
                {note.name || defaultItemName(note)}
              </CardTitle>
            </div>
          </div>
        </div>

        {/* Icon Section */}
        <div className="w-24 aspect-[5/6] flex-shrink-0 relative overflow-hidden rounded-sm bg-slate-100 flex items-center justify-center">
          <FileText className="w-8 h-8 text-slate-400" />
          {/* Three-dot menu button in top right */}
          <Button
            variant="ghost"
            size="sm"
            className="absolute top-1 right-1 h-6 w-6 p-0 text-muted-foreground hover:text-foreground hover:bg-muted-foreground/10 rounded-sm opacity-0 group-hover:opacity-100 transition-opacity"
            aria-label="More options"
            onClick={(e) => {
              e.stopPropagation()
              handleMoreOptions(e)
            }}
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </div>
      </Card>
    </div>
  )

  return (
    <EditorContextMenu
      ref={contextMenuRef}
      viewContext="folder-view"
      item={note}
    >
      {cardContent}
    </EditorContextMenu>
  )
}

export function NoteCard(props: ItemCardProps<Note>) {
  if (props.isLoading) {
    return <NoteCardSkeleton />
  }

  return (
    <ClientOnly fallback={<NoteCardSkeleton />}>
      <NoteCardInner {...props} />
    </ClientOnly>
  )
}

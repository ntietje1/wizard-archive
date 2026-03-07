import { useRef } from 'react'
import { ClientOnly, Link } from '@tanstack/react-router'
import { PERMISSION_LEVEL } from 'convex/permissions/types'
import { hasAtLeastPermissionLevel } from 'convex/permissions/hasAtLeastPermissionLevel'
import type { ItemCardProps } from './item-card'
import type { Note } from 'convex/notes/types'
import { Card, CardTitle } from '~/components/shadcn/ui/card'
import { Skeleton } from '~/components/shadcn/ui/skeleton'
import { Button } from '~/components/shadcn/ui/button'
import { FileText, MoreVertical } from '~/lib/icons'
import { useEditorLinkProps } from '~/hooks/useEditorLinkProps'
import { useLastEditorItem } from '~/hooks/useLastEditorItem'
import { useContextMenu } from '~/hooks/useContextMenu'
import { EditorContextMenu } from '~/components/context-menu/components/EditorContextMenu'
import { useDraggable } from '~/hooks/useDraggable'

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
  const ref = useRef<HTMLDivElement>(null)
  const linkProps = useEditorLinkProps(note)
  const { setLastSelectedItem } = useLastEditorItem()
  const canDrag = hasAtLeastPermissionLevel(
    note.myPermissionLevel,
    PERMISSION_LEVEL.FULL_ACCESS,
  )
  const { contextMenuRef, handleMoreOptions } = useContextMenu()

  const { isDraggingRef } = useDraggable({
    ref,
    data: { sidebarItemId: note._id },
    canDrag,
  })

  const cardContent = (
    <div ref={ref} className="w-full h-[140px]">
      <Link
        {...linkProps}
        activeOptions={{ includeSearch: false }}
        className="block w-full h-full [&.active]:pointer-events-auto"
        draggable={false}
        onClick={(e) => {
          if (isDraggingRef.current) {
            e.preventDefault()
            return
          }
          if (onClick) {
            e.preventDefault()
            onClick()
            return
          }
          setLastSelectedItem({ type: note.type, slug: note.slug })
        }}
      >
        <Card className="w-full h-full cursor-pointer transition-all hover:shadow-md group flex flex-row flex-nowrap items-stretch gap-4 p-2 relative rounded-md">
          {/* Left Content Section */}
          <div className="p-1 flex-1 min-w-0 flex flex-col justify-between">
            <div className="overflow-hidden">
              <div className="flex items-center gap-2 mb-2 min-w-0">
                <CardTitle className="text-sm font-medium text-foreground truncate select-none flex-1 min-w-0">
                  {note.name}
                </CardTitle>
              </div>
            </div>
          </div>

          {/* Icon Section */}
          <div className="w-24 aspect-[5/6] flex-shrink-0 relative overflow-hidden rounded-sm bg-muted flex items-center justify-center">
            <FileText className="w-8 h-8 text-muted-foreground" />
            {/* Three-dot menu button in top right */}
            <Button
              variant="ghost"
              size="sm"
              className="absolute top-1 right-1 h-6 w-6 p-0 text-muted-foreground hover:text-foreground hover:bg-muted-foreground/10 rounded-sm opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label="More options"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                handleMoreOptions(e)
              }}
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      </Link>
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

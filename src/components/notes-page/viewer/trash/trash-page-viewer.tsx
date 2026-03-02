import { useEffect, useRef } from 'react'
import { dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
import { ItemCard } from '../folder/item-card'
import { ContentGrid } from '~/components/content-grid-page/content-grid'
import { ScrollArea } from '~/components/shadcn/ui/scroll-area'
import { EditorContextMenu } from '~/components/context-menu/components/EditorContextMenu'
import { TrashBanner } from '~/components/notes-page/editor/deleted-item-banner'
import { LoadingSpinner } from '~/components/loading/loading-spinner'
import { useTrashedSidebarItems } from '~/hooks/useSidebarItems'
import { TRASH_DROP_ZONE_TYPE } from '~/lib/dnd-utils'
import { cn } from '~/lib/shadcn/utils'
import { useSidebarUIStore } from '~/stores/sidebarUIStore'
import { Trash2 } from '~/lib/icons'

export function TrashPageViewer() {
  const dropRef = useRef<HTMLDivElement>(null)

  const { parentItemsMap, status } = useTrashedSidebarItems()
  const rootTrashedItems = parentItemsMap.get(undefined) ?? []

  // Highlighting comes from the store (set by DragOverlay's monitor),
  // which already tracks only the innermost drop target.
  const isDropTarget = useSidebarUIStore(
    (s) => s.sidebarDragTargetId === TRASH_DROP_ZONE_TYPE,
  )
  const dragDropAction = useSidebarUIStore((s) => s.dragDropAction)
  const isTrashDrag = isDropTarget && dragDropAction === 'trash'

  // Register as a drop target. Re-run when status/length changes because
  // early returns swap which div is mounted.
  const hasItems = rootTrashedItems.length > 0
  useEffect(() => {
    const el = dropRef.current
    if (!el) return

    return dropTargetForElements({
      element: el,
      getData: () => ({ type: TRASH_DROP_ZONE_TYPE }),
    })
  }, [status, hasItems])

  if (status === 'pending') {
    return (
      <div className="flex-1 min-h-0 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!hasItems) {
    return (
      <EditorContextMenu
        viewContext="trash-view"
        className="flex flex-col h-full w-full min-h-0"
      >
        <div
          ref={dropRef}
          className={cn(
            'flex-1 min-h-0 flex flex-col items-center justify-center gap-2 text-muted-foreground transition-colors',
            isTrashDrag ? 'bg-destructive/10' : isDropTarget && 'bg-muted',
          )}
        >
          <Trash2 className="h-10 w-10 opacity-30" />
          <p className="text-sm">Trash is empty</p>
        </div>
      </EditorContextMenu>
    )
  }

  return (
    <EditorContextMenu
      viewContext="trash-view"
      className="flex flex-col h-full w-full min-h-0"
    >
      <div
        ref={dropRef}
        className={cn(
          'flex flex-col h-full w-full min-h-0 transition-colors',
          isTrashDrag ? 'bg-destructive/10' : isDropTarget && 'bg-muted',
        )}
      >
        <TrashBanner />

        {/* Grid */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="w-full min-w-0">
            <ContentGrid className="p-6 min-h-0">
              {rootTrashedItems.map((item) => (
                <ItemCard key={item._id} item={item} />
              ))}
            </ContentGrid>
          </div>
        </ScrollArea>
      </div>
    </EditorContextMenu>
  )
}

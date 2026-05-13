import { useRef } from 'react'
import { ClientOnly, Link } from '@tanstack/react-router'
import { PERMISSION_LEVEL } from 'convex/permissions/types'
import { hasAtLeastPermissionLevel } from 'convex/permissions/hasAtLeastPermissionLevel'
import { MapPin, MoreVertical } from 'lucide-react'
import type { GameMap } from 'convex/gameMaps/types'
import type { ItemCardProps } from './item-card'
import { Card, CardTitle } from '~/features/shadcn/components/card'
import { Button } from '~/features/shadcn/components/button'
import { cn } from '~/features/shadcn/lib/utils'
import { useEditorLinkProps } from '~/features/sidebar/hooks/useEditorLinkProps'
import { useLastEditorItem } from '~/features/sidebar/hooks/useLastEditorItem'
import { useSidebarItemVisualState } from '~/features/sidebar/hooks/useSelectedItem'
import { useContextMenu } from '~/features/context-menu/hooks/useContextMenu'
import { EditorContextMenu } from '~/features/context-menu/components/editor-context-menu'
import { useDraggable } from '~/features/dnd/hooks/useDraggable'
import { useItemSelectionInteractions } from '~/features/sidebar/hooks/useItemSelectionInteractions'
import { useSidebarDragData } from '~/features/dnd/hooks/useSidebarDragData'
import { useIsSidebarItemDragging } from '~/features/dnd/hooks/useIsSidebarItemDragging'
import { folderItemBackgroundClass, folderItemOutlineClass } from './folder-item-visual-state'
import {
  sidebarItemIconClass,
  sidebarItemNameClass,
} from '~/features/sidebar/utils/sidebar-item-visual-state'

function MapCardSkeleton() {
  return (
    <div className="w-full h-[140px]">
      <Card className="w-full h-full flex flex-col p-2 relative rounded-md">
        <div className="flex items-center justify-between mb-2">
          <div className="bg-muted rounded-md h-5 w-32" />
          <div className="bg-muted rounded-md size-6" />
        </div>
        <div className="w-full flex-1 bg-muted relative rounded-sm overflow-hidden">
          <div className="bg-muted w-full h-full" />
        </div>
      </Card>
    </div>
  )
}

function MapCardInner({
  item: map,
  onClick,
  parentId,
  visibleItemIds,
  itemSurface = 'folder-view',
}: ItemCardProps<GameMap>) {
  const ref = useRef<HTMLDivElement>(null)
  const linkProps = useEditorLinkProps(map)
  const { setLastSelectedItem } = useLastEditorItem()
  const canDrag = hasAtLeastPermissionLevel(map.myPermissionLevel, PERMISSION_LEVEL.FULL_ACCESS)
  const visualState = useSidebarItemVisualState(map)
  const { contextMenuRef, handleMoreOptions } = useContextMenu()
  const { handleItemClick, handleItemContextMenu } = useItemSelectionInteractions(map, {
    surface: itemSurface,
    parentId: parentId ?? null,
    visibleItemIds: visibleItemIds ?? [map._id],
  })
  const dragData = useSidebarDragData(map)
  const isDragging = useIsSidebarItemDragging(map._id)

  const previewUrl = map.previewUrl ?? null

  const { isDraggingRef } = useDraggable({
    ref,
    data: dragData,
    canDrag,
  })

  const cardContent = (
    <div ref={ref} className={cn('w-full h-[140px]', isDragging && 'opacity-50')}>
      <Link
        {...linkProps}
        activeOptions={{ includeSearch: false }}
        aria-label={map.name}
        data-item-selection-target="true"
        className="block w-full h-full [&.active]:pointer-events-auto"
        draggable={false}
        onContextMenu={handleItemContextMenu}
        onClick={(e) => {
          if (isDraggingRef.current) {
            e.preventDefault()
            return
          }
          if (onClick) {
            e.preventDefault()
            handleItemClick(e)
            onClick()
            return
          }
          handleItemClick(e, () => setLastSelectedItem(map.slug))
        }}
      >
        <Card
          className={cn(
            'w-full h-full cursor-pointer group flex flex-col p-2 relative rounded-md',
            folderItemBackgroundClass(visualState),
            folderItemOutlineClass(visualState),
          )}
        >
          {/* Top Section: Title + Menu Button */}
          <div className="flex items-center justify-between mb-1 min-w-0">
            <CardTitle
              className={cn(
                'p-1 text-sm font-medium truncate select-none flex-1 min-w-0',
                sidebarItemNameClass(visualState),
              )}
            >
              {map.name}
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              className="size-6 p-0 text-muted-foreground hover:text-foreground hover:bg-muted-foreground/10 rounded-sm flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                handleItemContextMenu(e)
                handleMoreOptions(e)
              }}
            >
              <MoreVertical className="size-4" />
            </Button>
          </div>

          {/* Image Section */}
          <div className="w-full flex-1 bg-muted relative rounded-sm overflow-hidden">
            {previewUrl ? (
              <img src={previewUrl} alt={map.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <MapPin className={cn('size-12', sidebarItemIconClass(visualState))} />
              </div>
            )}
            <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/10" />
          </div>
        </Card>
      </Link>
    </div>
  )

  return (
    <EditorContextMenu ref={contextMenuRef} viewContext="folder-view" item={map}>
      {cardContent}
    </EditorContextMenu>
  )
}

export function MapCard(props: ItemCardProps<GameMap>) {
  if (props.isLoading) {
    return <MapCardSkeleton />
  }

  return (
    <ClientOnly fallback={<MapCardSkeleton />}>
      <MapCardInner {...props} />
    </ClientOnly>
  )
}

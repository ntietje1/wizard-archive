import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import { useDndContext, useDraggable, useDroppable } from '@dnd-kit/core'
import { SIDEBAR_ITEM_TYPES } from 'convex/sidebarItems/types'
import { defaultItemName } from 'convex/sidebarItems/sidebarItems'
import type { GameMap } from 'convex/gameMaps/types'
import type { ItemCardProps } from './item-card'
import type { SidebarDragData, SidebarDropData } from '~/lib/dnd-utils'
import { canDropItem } from '~/lib/dnd-utils'
import { useFileSidebar } from '~/hooks/useFileSidebar'
import { Card, CardTitle } from '~/components/shadcn/ui/card'
import { Skeleton } from '~/components/shadcn/ui/skeleton'
import { MapPin } from '~/lib/icons'
import { useEditorNavigation } from '~/hooks/useEditorNavigation'
import { SidebarItemContextMenu } from '~/components/context-menu/sidebar/SidebarItemContextMenu'

export function MapCard({
  item: map,
  category,
  onClick,
  isLoading,
}: ItemCardProps<GameMap>) {
  const { navigateToMap } = useEditorNavigation()
  const { activeDragItem } = useFileSidebar()
  const isDisabled = activeDragItem !== null
  const { active, over } = useDndContext()

  const imageUrlQuery = useQuery(
    convexQuery(
      api.storage.queries.getDownloadUrl,
      map.imageStorageId ? { storageId: map.imageStorageId } : 'skip',
    ),
  )

  const imageUrl = imageUrlQuery.data || null

  const categoryId = map.categoryId
  const dragData: SidebarDragData | undefined = categoryId
    ? {
        _id: map._id,
        type: SIDEBAR_ITEM_TYPES.gameMaps,
        name: map.name || defaultItemName(map),
        parentId: map.parentId,
        categoryId,
        icon: MapPin,
      }
    : undefined

  const {
    setNodeRef: setDragRef,
    listeners,
    attributes,
    isDragging,
  } = useDraggable({
    id: map._id,
    data: dragData,
    disabled: isDisabled || !categoryId,
  })

  const dropData: SidebarDropData | undefined = categoryId
    ? {
        _id: map._id,
        type: SIDEBAR_ITEM_TYPES.gameMaps,
        categoryId,
      }
    : undefined

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: map._id,
    data: dropData,
    disabled: !categoryId,
  })

  const isValidDropTarget =
    isOver && active && over && canDropItem(active, over)

  const handleCardActivate = () => {
    if (!isDragging) {
      if (onClick) {
        onClick()
      } else {
        navigateToMap(map.slug)
      }
    }
  }

  if (isLoading) {
    return (
      <Card className="bg-white border border-slate-200 w-full">
        <div className="aspect-video bg-slate-100 relative">
          <Skeleton className="w-full h-full" />
        </div>
        <div className="p-4">
          <Skeleton className="h-6 w-32 mb-2" />
          <Skeleton className="h-4 w-24" />
        </div>
      </Card>
    )
  }

  const cardContent = (
    <div
      ref={(el) => {
        setDropRef(el)
        setDragRef(el)
      }}
      {...listeners}
      {...attributes}
      className={isDragging ? 'opacity-20' : ''}
    >
      <Card
        className={`bg-white border border-slate-200 w-full cursor-pointer transition-all hover:shadow-md group relative overflow-hidden ${
          isValidDropTarget ? 'ring-2 ring-primary' : ''
        }`}
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
        <div className="aspect-video bg-slate-100 relative overflow-hidden">
          {imageUrlQuery.isLoading && map.imageStorageId ? (
            <Skeleton className="w-full h-full" />
          ) : imageUrl ? (
            <img
              src={imageUrl}
              alt={map.name || defaultItemName(map)}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200">
              <MapPin className="w-16 h-16 text-slate-400" />
            </div>
          )}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
        </div>
        <div className="p-4">
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <MapPin className="w-5 h-5 text-blue-600 flex-shrink-0" />
              <CardTitle className="text-lg text-slate-800 truncate">
                {map.name || defaultItemName(map)}
              </CardTitle>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )

  return (
    <SidebarItemContextMenu
      item={map}
      viewContext="folder-view"
      category={category}
    >
      {cardContent}
    </SidebarItemContextMenu>
  )
}

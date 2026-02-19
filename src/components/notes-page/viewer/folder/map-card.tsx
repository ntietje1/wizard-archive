import { useEffect, useRef } from 'react'
import { ClientOnly } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import { draggable } from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
import { disableNativeDragPreview } from '@atlaskit/pragmatic-drag-and-drop/element/disable-native-drag-preview'
import { defaultItemName } from 'convex/sidebarItems/sidebarItems'
import { PERMISSION_LEVEL } from 'convex/shares/types'
import { hasAtLeastPermissionLevel } from 'convex/shares/itemShares'
import type { GameMap } from 'convex/gameMaps/types'
import type { ItemCardProps } from './item-card'
import type { SidebarDragData } from '~/lib/dnd-utils'
import { Card, CardTitle } from '~/components/shadcn/ui/card'
import { Skeleton } from '~/components/shadcn/ui/skeleton'
import { Button } from '~/components/shadcn/ui/button'
import { MapPin, MoreVertical } from '~/lib/icons'
import { useEditorNavigation } from '~/hooks/useEditorNavigation'
import { useContextMenu } from '~/hooks/useContextMenu'
import { EditorContextMenu } from '~/components/context-menu/components/EditorContextMenu'

function MapCardSkeleton() {
  return (
    <div className="w-full h-[140px]">
      <Card className="w-full h-full flex flex-col p-2 relative rounded-md">
        <div className="flex items-center justify-between mb-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="w-6 h-6 rounded" />
        </div>
        <div className="w-full flex-1 bg-slate-100 relative rounded-sm overflow-hidden">
          <Skeleton className="w-full h-full" />
        </div>
      </Card>
    </div>
  )
}

function MapCardInner({ item: map, onClick }: ItemCardProps<GameMap>) {
  const ref = useRef<HTMLDivElement>(null)
  const { navigateToMap } = useEditorNavigation()
  const isDraggingRef = useRef(false)
  const canDrag = hasAtLeastPermissionLevel(
    map.myPermissionLevel,
    PERMISSION_LEVEL.FULL_ACCESS,
  )
  const { contextMenuRef, handleMoreOptions } = useContextMenu()

  const imageUrlQuery = useQuery(
    convexQuery(
      api.storage.queries.getDownloadUrl,
      map.imageStorageId ? { storageId: map.imageStorageId } : 'skip',
    ),
  )

  const imageUrl = imageUrlQuery.data || null

  const dragDataRef = useRef<SidebarDragData>(map)
  dragDataRef.current = map

  useEffect(() => {
    const el = ref.current
    if (!el || !canDrag) return

    return draggable({
      element: el,
      getInitialData: () => dragDataRef.current,
      onGenerateDragPreview: ({ nativeSetDragImage }) => {
        disableNativeDragPreview({ nativeSetDragImage })
      },
      onDragStart: () => {
        isDraggingRef.current = true
        el.style.opacity = '0.2'
      },
      onDrop: () => {
        isDraggingRef.current = false
        el.style.opacity = ''
      },
    })
  }, [map._id, canDrag])

  const handleCardActivate = () => {
    if (!isDraggingRef.current) {
      if (onClick) {
        onClick()
      } else {
        navigateToMap(map.slug)
      }
    }
  }

  const cardContent = (
    <div ref={ref} className="w-full h-[140px]">
      <Card
        className="w-full h-full cursor-pointer transition-all hover:shadow-md group flex flex-col p-2 relative rounded-md"
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
        {/* Top Section: Title + Menu Button */}
        <div className="flex items-center justify-between mb-1 min-w-0">
          <CardTitle className="p-1 text-sm font-medium text-slate-800 truncate select-none flex-1 min-w-0">
            {map.name || defaultItemName(map)}
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground hover:bg-muted-foreground/10 rounded-sm flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => {
              e.stopPropagation()
              handleMoreOptions(e)
            }}
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </div>

        {/* Image Section */}
        <div className="w-full flex-1 bg-slate-100 relative rounded-sm overflow-hidden">
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
              <MapPin className="w-12 h-12 text-slate-400" />
            </div>
          )}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
        </div>
      </Card>
    </div>
  )

  return (
    <EditorContextMenu
      ref={contextMenuRef}
      viewContext="folder-view"
      item={map}
    >
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

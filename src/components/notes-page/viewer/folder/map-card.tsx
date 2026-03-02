import { useRef } from 'react'
import { ClientOnly, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import { PERMISSION_LEVEL } from 'convex/permissions/types'
import { hasAtLeastPermissionLevel } from 'convex/permissions/hasAtLeastPermissionLevel'
import type { GameMap } from 'convex/gameMaps/types'
import type { ItemCardProps } from './item-card'
import { Card, CardTitle } from '~/components/shadcn/ui/card'
import { Skeleton } from '~/components/shadcn/ui/skeleton'
import { Button } from '~/components/shadcn/ui/button'
import { MapPin, MoreVertical } from '~/lib/icons'
import { useEditorLinkProps } from '~/hooks/useEditorLinkProps'
import { useLastEditorItem } from '~/hooks/useLastEditorItem'
import { useContextMenu } from '~/hooks/useContextMenu'
import { EditorContextMenu } from '~/components/context-menu/components/EditorContextMenu'
import { useDraggable } from '~/hooks/useDraggable'

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
  const linkProps = useEditorLinkProps(map)
  const { setLastSelectedItem } = useLastEditorItem()
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

  const { isDraggingRef } = useDraggable({
    ref,
    data: map,
    canDrag,
    dragOpacity: '0.2',
  })

  const cardContent = (
    <div ref={ref} className="w-full h-[140px]">
      <Link
        {...linkProps}
        activeOptions={{ includeSearch: false }}
        className="block w-full h-full [&.active]:pointer-events-auto"
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
          setLastSelectedItem({ type: map.type, slug: map.slug })
        }}
      >
        <Card className="w-full h-full cursor-pointer transition-all hover:shadow-md group flex flex-col p-2 relative rounded-md">
          {/* Top Section: Title + Menu Button */}
          <div className="flex items-center justify-between mb-1 min-w-0">
            <CardTitle className="p-1 text-sm font-medium text-slate-800 truncate select-none flex-1 min-w-0">
              {map.name}
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground hover:bg-muted-foreground/10 rounded-sm flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => {
                e.preventDefault()
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
                alt={map.name}
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
      </Link>
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

import { useConvexMutation, convexQuery } from '@convex-dev/react-query'
import { useQuery } from '@tanstack/react-query'
import { api } from 'convex/_generated/api'
import { SIDEBAR_ITEM_TYPES, type Map } from 'convex/notes/types'
import { useState, type MouseEvent } from 'react'
import { MapDeleteConfirmDialog } from '~/components/dialogs/delete/map-delete-confirm-dialog'
import { MapPin, Edit, Trash2 } from '~/lib/icons'
import { useDraggable, useDroppable, useDndContext } from '@dnd-kit/core'
import {
  validateCategoryItemDrop,
  type CategoryDragData,
  type CategoryDropData,
} from '../../$categorySlug/-components/dnd-utils'
import { useCategoryDrag } from '~/contexts/CategoryDragContext'
import { Card, CardTitle } from '~/components/shadcn/ui/card'
import { Skeleton } from '~/components/shadcn/ui/skeleton'
import { Button } from '~/components/shadcn/ui/button'
import { LocationsMapContextMenu as MapContextMenu } from '~/components/context-menu/map/locations-map-context-menu'
import type { TagCategoryConfig } from '~/components/forms/category-tag-form/base-tag-form/types'
import type { Id } from 'convex/_generated/dataModel'
import { MapDialog } from '~/components/forms/map-form/map-dialog'
import { MapViewDialog } from './map-view-dialog'

export interface MapCardProps {
  map?: Map
  categoryId?: Id<'tagCategories'>
  categoryConfig?: TagCategoryConfig
  onClick?: (e: MouseEvent) => void
  className?: string
  isLoading?: boolean
}

export function MapCardWithContextMenu(props: MapCardProps) {
  if (!props.categoryConfig) {
    return <MapCard {...props} />
  }
  return (
    <MapContextMenu map={props.map}>
      <MapCard {...props} />
    </MapContextMenu>
  )
}

export function MapCard({
  map,
  categoryId,
  onClick,
  className = '',
  isLoading = false,
}: MapCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isViewing, setIsViewing] = useState(false)
  const { activeDragItem } = useCategoryDrag()
  const isDisabled = activeDragItem !== null
  const { active } = useDndContext()

  const imageUrlQuery = useQuery(
    convexQuery(
      api.storage.queries.getDownloadUrl,
      map?.imageStorageId ? { storageId: map.imageStorageId } : 'skip',
    ),
  )

  const imageUrl = imageUrlQuery.data || null

  const dragData: CategoryDragData | undefined =
    map && categoryId
      ? {
          _id: map._id,
          type: SIDEBAR_ITEM_TYPES.maps,
          name: map.name || 'Untitled Map',
          parentFolderId: map.parentFolderId,
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
    id: map?._id || 'temp-map-id',
    data: dragData,
    disabled: isDisabled || !map || !categoryId,
  })

  const handleCardActivate = (e?: MouseEvent) => {
    if (!isDragging && onClick) {
      onClick(e || ({} as MouseEvent))
    } else if (!isDragging && map) {
      setIsViewing(true)
    }
  }

  if (isLoading || !map || !categoryId) {
    return (
      <Card className={`bg-white border border-slate-200 w-full ${className}`}>
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

  const dropData: CategoryDropData = {
    _id: map._id,
    type: SIDEBAR_ITEM_TYPES.maps,
    categoryId,
  }
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: map._id,
    data: dropData,
  })

  const isValidDropTarget =
    isOver &&
    validateCategoryItemDrop(
      active?.data?.current as CategoryDragData | null,
      dropData,
    )

  return (
    <>
      <div
        ref={(el) => {
          setDropRef(el)
          setDragRef(el)
        }}
        {...listeners}
        {...attributes}
        className={`${className} ${isDragging ? 'opacity-20' : ''}`}
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
                alt={map.name}
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
                  {map.name || 'Untitled Map'}
                </CardTitle>
              </div>
              {!isDisabled && (
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e: MouseEvent) => {
                      e.stopPropagation()
                      setIsEditing(true)
                    }}
                    className="bg-white/90 hover:bg-white shadow-sm"
                    aria-label="Edit"
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e: MouseEvent) => {
                      e.stopPropagation()
                      setIsDeleting(true)
                    }}
                    className="bg-white/90 hover:bg-white shadow-sm text-red-600 hover:text-red-700"
                    aria-label="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>

      {isEditing && map && (
        <MapDialog
          mapId={map._id}
          isOpen={isEditing}
          onClose={() => setIsEditing(false)}
          campaignId={map.campaignId}
        />
      )}

      {isViewing && map && (
        <MapViewDialog
          mapId={map._id}
          isOpen={isViewing}
          onClose={() => setIsViewing(false)}
        />
      )}

      {map && (
        <MapDeleteConfirmDialog
          map={map}
          isDeleting={isDeleting}
          onClose={() => setIsDeleting(false)}
        />
      )}
    </>
  )
}

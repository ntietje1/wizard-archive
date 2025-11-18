import {
  ContextMenu,
  type ContextMenuRef,
  type ContextMenuItem,
} from '~/components/context-menu/context-menu'
import { forwardRef, useMemo, useState } from 'react'
import type { Map } from 'convex/notes/types'
import { MapPin, Edit, Trash2 } from '~/lib/icons'
import { useMutation } from '@tanstack/react-query'
import { useConvexMutation } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import { toast } from 'sonner'
import { MapDialog } from '~/components/forms/map-form/map-dialog'
import { ConfirmationDialog } from '~/components/dialogs/confirmation-dialog'

export interface MapContextMenuProps {
  children: React.ReactNode
  map?: Map
}

export const MapContextMenu = forwardRef<ContextMenuRef, MapContextMenuProps>(
  ({ children, map }, ref) => {
    const [isEditing, setIsEditing] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)
    const [isDeletingMap, setIsDeletingMap] = useState(false)

    const deleteMapMutation = useMutation({
      mutationFn: useConvexMutation(api.locations.mutations.deleteMap),
    })

    const handleDelete = async () => {
      if (!map) return
      setIsDeletingMap(true)
      try {
        await deleteMapMutation.mutateAsync({ mapId: map._id })
        toast.success('Map deleted')
        setIsDeleting(false)
      } catch (error) {
        toast.error('Failed to delete map')
      } finally {
        setIsDeletingMap(false)
      }
    }

    const menuItems = useMemo(() => {
      if (!map) {
        return []
      }

      const items: ContextMenuItem[] = [
        {
          type: 'action',
          label: 'Edit',
          icon: <Edit className="h-4 w-4" />,
          onClick: () => setIsEditing(true),
        },
        {
          type: 'action',
          label: 'Delete',
          icon: <Trash2 className="h-4 w-4" />,
          onClick: () => setIsDeleting(true),
        },
      ]
      return items
    }, [map, setIsEditing, setIsDeleting])

    return (
      <>
        <ContextMenu ref={ref} items={menuItems} menuClassName="w-64">
          {children}
        </ContextMenu>

        {map && (
          <>
            <MapDialog
              mapId={map._id}
              isOpen={isEditing}
              onClose={() => setIsEditing(false)}
              campaignId={map.campaignId}
            />

            <ConfirmationDialog
              isOpen={isDeleting}
              onClose={() => setIsDeleting(false)}
              onConfirm={handleDelete}
              title="Delete Map"
              description={`Are you sure you want to delete "${map.name || 'this map'}"? This action cannot be undone.`}
              confirmLabel="Delete Map"
              isLoading={isDeletingMap}
              icon={MapPin}
            />
          </>
        )}
      </>
    )
  },
)

MapContextMenu.displayName = 'MapContextMenu'

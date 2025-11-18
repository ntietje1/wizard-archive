import { MapPin, FileEdit, Trash2 } from '~/lib/icons'
import {
  ContextMenu,
  type ContextMenuItem,
  type ContextMenuRef,
} from '~/components/context-menu/context-menu'
import type { Map } from 'convex/notes/types'
import { useFileSidebar } from '~/contexts/FileSidebarContext'
import { toast } from 'sonner'
import { useCallback, useState, forwardRef } from 'react'
import { ConfirmationDialog } from '~/components/dialogs/confirmation-dialog'
import { useMutation } from '@tanstack/react-query'
import { useConvexMutation } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import { MapDialog } from '~/components/forms/map-form/map-dialog'

interface MapContextMenuProps {
  map: Map
  children: React.ReactNode
}

export const MapContextMenu = forwardRef<ContextMenuRef, MapContextMenuProps>(
  ({ map, children }, ref) => {
    const [confirmDeleteDialogOpen, setConfirmDeleteDialogOpen] =
      useState(false)
    const [isEditing, setIsEditing] = useState(false)
    const { setRenamingId } = useFileSidebar()

    const deleteMapMutation = useMutation({
      mutationFn: useConvexMutation(api.locations.mutations.deleteMap),
    })

    const handleRenameMap = () => {
      setRenamingId(map._id)
    }

    const handleEditMap = () => {
      setIsEditing(true)
    }

    const handleDeleteMap = () => {
      setConfirmDeleteDialogOpen(true)
    }

    const confirmDeleteMap = useCallback(async () => {
      await deleteMapMutation
        .mutateAsync({ mapId: map._id })
        .then(() => {
          toast.success('Map deleted')
        })
        .catch((error: Error) => {
          console.error(error)
          toast.error('Failed to delete map')
        })
        .finally(() => {
          setConfirmDeleteDialogOpen(false)
        })
    }, [deleteMapMutation, map._id])

    const menuItems: ContextMenuItem[] = [
      {
        type: 'action',
        label: 'Rename',
        icon: <FileEdit className="h-4 w-4" />,
        onClick: handleRenameMap,
      },
      {
        type: 'action',
        label: 'Edit Map',
        icon: <FileEdit className="h-4 w-4" />,
        onClick: handleEditMap,
      },
      {
        type: 'action',
        label: 'Delete',
        icon: <Trash2 className="h-4 w-4" />,
        onClick: handleDeleteMap,
        className: 'text-red-600 focus:text-red-600',
      },
    ]

    return (
      <>
        <ContextMenu ref={ref} items={menuItems}>
          {children}
        </ContextMenu>
        <ConfirmationDialog
          isOpen={confirmDeleteDialogOpen}
          onClose={() => setConfirmDeleteDialogOpen(false)}
          onConfirm={confirmDeleteMap}
          title="Delete Map"
          description="Are you sure you want to delete this map? This action cannot be undone."
          confirmLabel="Delete Map"
          confirmVariant="destructive"
          icon={MapPin}
        />
        <MapDialog
          mapId={map._id}
          isOpen={isEditing}
          onClose={() => setIsEditing(false)}
          campaignId={map.campaignId}
          categoryId={map.categoryId}
          parentFolderId={map.parentFolderId}
        />
      </>
    )
  },
)

MapContextMenu.displayName = 'MapContextMenu'

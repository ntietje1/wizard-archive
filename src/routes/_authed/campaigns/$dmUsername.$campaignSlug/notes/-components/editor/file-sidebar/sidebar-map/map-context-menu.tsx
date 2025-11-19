import { FileEdit, Trash2 } from '~/lib/icons'
import {
  ContextMenu,
  type ContextMenuItem,
  type ContextMenuRef,
} from '~/components/context-menu/context-menu'
import type { Map } from 'convex/notes/types'
import { useFileSidebar } from '~/contexts/FileSidebarContext'
import { useCallback, useState, forwardRef } from 'react'
import { MapDeleteConfirmDialog } from '~/components/dialogs/delete/map-delete-confirm-dialog'
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

    const handleRenameMap = () => {
      setRenamingId(map._id)
    }

    const handleEditMap = () => {
      setIsEditing(true)
    }

    const handleDeleteMap = () => {
      setConfirmDeleteDialogOpen(true)
    }

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
        <MapDeleteConfirmDialog
          map={map}
          isDeleting={confirmDeleteDialogOpen}
          onClose={() => setConfirmDeleteDialogOpen(false)}
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

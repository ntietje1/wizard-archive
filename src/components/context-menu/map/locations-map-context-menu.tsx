import {
  ContextMenu,
  type ContextMenuRef,
  type ContextMenuItem,
} from '~/components/context-menu/base/context-menu'
import { forwardRef, useMemo, useState } from 'react'
import type { Map } from 'convex/notes/types'
import { Edit, Trash2 } from '~/lib/icons'
import { MapDialog } from '~/components/forms/map-form/map-dialog'
import { MapDeleteConfirmDialog } from '~/components/dialogs/delete/map-delete-confirm-dialog'

export interface LocationsMapContextMenuProps {
  children: React.ReactNode
  map?: Map
}

export const LocationsMapContextMenu = forwardRef<ContextMenuRef, LocationsMapContextMenuProps>(
  ({ children, map }, ref) => {
    const [isEditing, setIsEditing] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)

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

            {map && (
              <MapDeleteConfirmDialog
                map={map}
                isDeleting={isDeleting}
                onClose={() => setIsDeleting(false)}
              />
            )}
          </>
        )}
      </>
    )
  },
)

LocationsMapContextMenu.displayName = 'LocationsMapContextMenu'


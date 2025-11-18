import type { Map } from 'convex/notes/types'
import { useFileSidebar } from '~/contexts/FileSidebarContext'
import { useMutation } from '@tanstack/react-query'
import { useConvexMutation } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import { MapContextMenu } from './map-context-menu'
import { DraggableMap } from './draggable-map'
import { SidebarItemButtonBase } from '../sidebar-item/sidebar-item-button-base'
import { FileEdit, MapPin } from '~/lib/icons'
import { useContextMenu } from '~/hooks/useContextMenu'
import { useState } from 'react'
import { MapViewDialog } from '~/routes/_authed/campaigns/$dmUsername.$campaignSlug/categories/locations/-components/map-view-dialog'
import type { Id } from 'convex/_generated/dataModel'

interface MapButtonProps {
  map: Map
  ancestorIds?: Id<'folders'>[]
}

export function MapButton({ map, ancestorIds = [] }: MapButtonProps) {
  const { renamingId, setRenamingId } = useFileSidebar()
  const { contextMenuRef, handleMoreOptions } = useContextMenu()
  const [isViewing, setIsViewing] = useState(false)

  const updateMapMutation = useMutation({
    mutationFn: useConvexMutation(api.locations.mutations.updateMap),
  })

  const handleFinishRename = async (name: string) => {
    await updateMapMutation.mutateAsync({ mapId: map._id, name })
    setRenamingId(null)
  }

  const handleSelect = () => {
    setIsViewing(true)
  }

  return (
    <>
      <DraggableMap map={map} ancestorIds={ancestorIds}>
        <MapContextMenu ref={contextMenuRef} map={map}>
          <SidebarItemButtonBase
            icon={MapPin}
            editIcon={FileEdit}
            name={map.name || 'Untitled Map'}
            defaultName="Untitled Map"
            isSelected={false}
            isRenaming={renamingId === map._id}
            showChevron={false}
            onSelect={handleSelect}
            onMoreOptions={handleMoreOptions}
            onFinishRename={handleFinishRename}
          />
        </MapContextMenu>
      </DraggableMap>

      {isViewing && (
        <MapViewDialog
          mapId={map._id}
          isOpen={isViewing}
          onClose={() => setIsViewing(false)}
        />
      )}
    </>
  )
}

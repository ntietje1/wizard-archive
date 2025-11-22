import { UNTITLED_MAP_NAME, type GameMap } from 'convex/gameMaps/types'
import { useFileSidebar } from '~/contexts/FileSidebarContext'
import { useMutation } from '@tanstack/react-query'
import { useConvexMutation } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import { SidebarMapContextMenu as MapContextMenu } from '~/components/context-menu/sidebar/location/sidebar-map-context-menu'
import { DraggableMap } from './draggable-map'
import { SidebarItemButtonBase } from '../sidebar-item/sidebar-item-button-base'
import { MapPin } from '~/lib/icons'
import { useContextMenu } from '~/hooks/useContextMenu'
import type { Id } from 'convex/_generated/dataModel'
import { useNavigate } from '@tanstack/react-router'
import { useCampaign } from '~/contexts/CampaignContext'

interface MapButtonProps {
  map: GameMap
  ancestorIds?: Id<'folders'>[]
}

export function MapButton({ map, ancestorIds = [] }: MapButtonProps) {
  const { renamingId, setRenamingId } = useFileSidebar()
  const { contextMenuRef, handleMoreOptions } = useContextMenu()
  const navigate = useNavigate()
  const { dmUsername, campaignSlug } = useCampaign()

  const updateMapMutation = useMutation({
    mutationFn: useConvexMutation(api.gameMaps.mutations.updateMap),
  })

  const handleFinishRename = async (name: string) => {
    await updateMapMutation.mutateAsync({ mapId: map._id, name })
    setRenamingId(null)
  }

  const handleSelect = () => {
    navigate({
      to: '/campaigns/$dmUsername/$campaignSlug/notes',
      params: { dmUsername, campaignSlug },
      search: {
        mapId: map._id,
      },
    })
  }

  return (
    <DraggableMap map={map} ancestorIds={ancestorIds}>
      <MapContextMenu ref={contextMenuRef} map={map}>
        <SidebarItemButtonBase
          icon={MapPin}
          name={map.name || UNTITLED_MAP_NAME}
          defaultName={UNTITLED_MAP_NAME}
          isSelected={false}
          isRenaming={renamingId === map._id}
          showChevron={false}
          onSelect={handleSelect}
          onMoreOptions={handleMoreOptions}
          onFinishRename={handleFinishRename}
        />
      </MapContextMenu>
    </DraggableMap>
  )
}

import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { api } from 'convex/_generated/api'
import type { GameMapWithContent } from 'shared/game-maps/types'
import { MAP_DROP_ZONE_TYPE } from '~/features/dnd/utils/drop-target-data'
import { registerSurfaceDropExecutor } from '~/features/dnd/utils/surface-drop-command'
import { useCampaignMutation } from '~/shared/hooks/useCampaignMutation'
import { buildMapPinPlacementInputs, getImagePinPosition } from './map-pin-placement'

export function useMapSidebarItemDropTarget({
  map,
  imageRef,
  canPin,
}: {
  map: GameMapWithContent
  imageRef: React.RefObject<HTMLImageElement | null>
  canPin: boolean
}) {
  const createItemPinsMutation = useCampaignMutation(api.gameMaps.mutations.createItemPins)
  const mapRef = useRef(map)
  mapRef.current = map
  const imageRefRef = useRef(imageRef)
  imageRefRef.current = imageRef

  useEffect(() => {
    if (!canPin) return
    return registerSurfaceDropExecutor({
      action: 'pin',
      target: {
        type: MAP_DROP_ZONE_TYPE,
        mapId: map._id,
        mapName: map.name,
      },
      execute: async (pinCommand, input) => {
        const position = getImagePinPosition(imageRefRef.current.current, input)
        if (!position) {
          toast.error('No image loaded - cannot place pin')
          return
        }

        const itemIds = pinCommand.items.map((item) => item._id)
        if (itemIds.length === 0) return
        const pinIds = await createItemPinsMutation.mutateAsync({
          mapId: mapRef.current._id,
          pins: buildMapPinPlacementInputs(itemIds, position),
        })
        toast.success(
          pinIds.length === 1 ? 'Pin placed on map' : `${pinIds.length} pins placed on map`,
        )
      },
    })
  }, [canPin, createItemPinsMutation, map._id, map.name])
}

import { useEffect, useRef } from 'react'
import { monitorForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
import { toast } from 'sonner'
import { api } from 'convex/_generated/api'
import type { GameMapWithContent } from 'shared/game-maps/types'
import type { Id } from 'convex/_generated/dataModel'
import type { AnySidebarItem } from 'shared/sidebar-items/model-types'
import { MAP_DROP_ZONE_TYPE } from '~/features/dnd/utils/drop-target-data'
import {
  executeSurfaceDropCommand,
  resolveSidebarSurfaceDropCommand,
} from '~/features/dnd/utils/surface-drop-command'
import { useDndStore } from '~/features/dnd/stores/dnd-store'
import { useCampaignMutation } from '~/shared/hooks/useCampaignMutation'
import { buildMapPinPlacementInputs, getImagePinPosition } from './map-pin-placement'

export function useMapSidebarItemDropTarget({
  map,
  imageRef,
  itemsMap,
  trashedItemsMap,
}: {
  map: GameMapWithContent
  imageRef: React.RefObject<HTMLImageElement | null>
  itemsMap: ReadonlyMap<Id<'sidebarItems'>, AnySidebarItem>
  trashedItemsMap: ReadonlyMap<Id<'sidebarItems'>, AnySidebarItem>
}) {
  const createItemPinsMutation = useCampaignMutation(api.gameMaps.mutations.createItemPins)
  const setBatchDecision = useDndStore((s) => s.setBatchDecision)
  const mapRef = useRef(map)
  mapRef.current = map
  const itemsMapRef = useRef(itemsMap)
  itemsMapRef.current = itemsMap
  const trashedItemsMapRef = useRef(trashedItemsMap)
  trashedItemsMapRef.current = trashedItemsMap
  const imageRefRef = useRef(imageRef)
  imageRefRef.current = imageRef

  useEffect(() => {
    return monitorForElements({
      onDrop: ({ source, location }) => {
        const topTarget = location.current.dropTargets[0]
        if (!topTarget) return

        const targetData = topTarget.data
        if (targetData.type !== MAP_DROP_ZONE_TYPE) return
        if (targetData.mapId !== mapRef.current._id) return

        const position = getImagePinPosition(imageRefRef.current.current, location.current.input)
        if (!position) {
          toast.error('No image loaded - cannot place pin')
          return
        }

        const command = resolveSidebarSurfaceDropCommand({
          sourceData: source.data,
          activeItemsMap: itemsMapRef.current,
          trashedItemsMap: trashedItemsMapRef.current,
          target: {
            type: MAP_DROP_ZONE_TYPE,
            mapId: mapRef.current._id,
            mapName: mapRef.current.name,
            pinnedItemIds: mapRef.current.pins.map((pin) => pin.itemId),
          },
          planningContext: {
            campaignId: mapRef.current.campaignId,
          },
        })

        void executeSurfaceDropCommand({
          command,
          action: 'pin',
          setBatchDecision,
          failureMessage: 'Failed to place pins',
          execute: async (pinCommand) => {
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
      },
    })
  }, [createItemPinsMutation, setBatchDecision])
}

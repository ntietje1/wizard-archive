import { useEffect, useMemo, useRef } from 'react'
import { toast } from 'sonner'
import type { MaybePromise } from '../../../../../shared/common/async'
import type { SidebarItemId } from '../../../../../shared/common/ids'
import type { MapItemWithContent } from '../../game-maps/item-contract'
import type { MapPinsCreateResult } from '../session-contract'
import { MAP_DROP_ZONE_TYPE } from '../../drag-drop/drop-target-data'
import { useDndRuntimeDropData } from '../../drag-drop/context'
import { registerSurfaceDropExecutor } from '../../drag-drop/surface-command'
import { createMapPinsAtPosition } from './map-pin-creation'
import type { MapPinPlacementInput } from './map-pin-placement'
import { getImagePinPosition } from './map-pin-placement'

export function useMapSidebarItemDropTarget({
  canPin,
  createMapPins,
  imageRef,
  layerId,
  map,
}: {
  canPin: boolean
  createMapPins: (input: {
    mapId: SidebarItemId
    pins: Array<MapPinPlacementInput>
  }) => MaybePromise<MapPinsCreateResult>
  imageRef: React.RefObject<HTMLImageElement | null>
  layerId?: string | null
  map: MapItemWithContent
}) {
  const mapRef = useRef(map)
  mapRef.current = map
  const imageRefRef = useRef(imageRef)
  imageRefRef.current = imageRef
  const rawDropData = useMemo(
    () => ({
      type: MAP_DROP_ZONE_TYPE,
      mapId: map.id,
      mapName: map.name,
    }),
    [map.id, map.name],
  )
  const dropData = useDndRuntimeDropData(rawDropData)

  useEffect(() => {
    if (!canPin) return
    return registerSurfaceDropExecutor({
      action: 'pin',
      target: dropData,
      execute: async (pinCommand, input) => {
        const position = getImagePinPosition(imageRefRef.current.current, input)
        if (!position) {
          toast.error('No image loaded - cannot place pin')
          return
        }

        const itemIds = pinCommand.items.map((item) => item.id)
        if (itemIds.length === 0) return
        await createMapPinsAtPosition({
          createMapPins,
          itemIds,
          layerId,
          mapId: mapRef.current.id,
          position,
        })
      },
    })
  }, [canPin, createMapPins, dropData, layerId])
}

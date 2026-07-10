import { useMemo } from 'react'
import type { MapPinMenuServiceState } from './service'
import { useMapViewOptional } from '../viewer/use-map-view'

export function useMapPinMenuServiceState(): MapPinMenuServiceState | null {
  const mapView = useMapViewOptional()

  return useMemo(() => {
    if (!mapView?.activeMap || !mapView.pinOperations || !mapView.pinRequests) {
      return null
    }

    return {
      activeMap: {
        id: mapView.activeMap.id,
        pinnedItemIds: new Set(mapView.activeMap.pins.map((pin) => pin.itemId)),
      },
      canEditActiveMap: mapView.canEditMap,
      activePin: mapView.activePin
        ? {
            id: mapView.activePin.id,
            item:
              mapView.activePin.item && mapView.canViewPinItem(mapView.activePin)
                ? mapView.activePin.item
                : null,
            visible: mapView.activePin.visible,
          }
        : null,
      pinOperations: mapView.pinOperations,
      pinRequests: mapView.pinRequests,
    }
  }, [mapView])
}

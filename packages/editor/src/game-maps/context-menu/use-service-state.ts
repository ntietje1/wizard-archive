import type { MapPinMenuServiceState } from './service'
import { useMapViewOptional } from '../viewer/use-map-view'

export function useMapPinMenuServiceState(): MapPinMenuServiceState | null {
  const mapView = useMapViewOptional()
  const activeMap = mapView?.activeMap
  if (!activeMap || !mapView.pinOperations || !mapView.pinRequests) return null

  return {
    activeMap: {
      id: activeMap.id,
      pinnedItemIds: new Set(activeMap.pins.map((pin) => pin.itemId)),
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
}

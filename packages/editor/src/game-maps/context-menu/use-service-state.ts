import { useEffect, useState } from 'react'
import type { MapPinMenuServiceState } from './service'
import { useMapView } from '../viewer/use-map-view'
import { usePublishedMapPinMenuState, useSetPublishedMapPinMenuState } from './state-context-value'

export function useMapPinMenuServiceState(): MapPinMenuServiceState | null {
  return usePublishedMapPinMenuState()?.state ?? null
}

export function MapPinMenuStatePublisher() {
  const mapView = useMapView()
  const setPublished = useSetPublishedMapPinMenuState()
  const [owner] = useState(() => Symbol('map-pin-menu-state'))

  useEffect(() => {
    if (!setPublished || !mapView.activeMap || !mapView.pinOperations || !mapView.pinRequests)
      return
    const state = projectMapPinMenuServiceState(mapView)
    setPublished({ owner, state })

    return () => {
      setPublished((current) => (current?.owner === owner ? null : current))
    }
  }, [mapView, owner, setPublished])

  return null
}

function projectMapPinMenuServiceState(
  mapView: ReturnType<typeof useMapView>,
): MapPinMenuServiceState {
  if (!mapView.activeMap || !mapView.pinOperations || !mapView.pinRequests) {
    throw new Error('Map pin menu state requires an active map')
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
}

import type { GameMapWithContent, MapPinWithItem } from 'convex/gameMaps/types'
import type { Id } from 'convex/_generated/dataModel'
import { useMapViewStore } from '~/features/editor/stores/map-view-store'

export interface MapViewContextType {
  activeMap: GameMapWithContent | null
  activePin: MapPinWithItem | null
  setActivePinId: (pinId: Id<'mapPins'> | null) => void
}

export function useMapView(): MapViewContextType {
  const activeMap = useMapViewStore((s) => s.activeMap)
  const pins = useMapViewStore((s) => s.pins)
  const activePinId = useMapViewStore((s) => s.activePinId)
  const setActivePinId = useMapViewStore((s) => s.setActivePinId)
  return {
    activeMap,
    activePin: pins.find((pin) => pin._id === activePinId) ?? null,
    setActivePinId,
  }
}

export function useMapViewOptional(): MapViewContextType | null {
  const result = useMapView()
  if (!result.activeMap) return null
  return result
}

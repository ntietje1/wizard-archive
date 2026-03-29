import { create } from 'zustand'
import type { Id } from 'convex/_generated/dataModel'
import type { GameMapWithContent, MapPinWithItem } from 'convex/gameMaps/types'

interface MapViewState {
  activeMap: GameMapWithContent | null
  pins: Array<MapPinWithItem>
  activePinId: Id<'mapPins'> | null
}

interface MapViewActions {
  setActiveMap: (
    map: GameMapWithContent | null,
    pins: Array<MapPinWithItem>,
  ) => void
  setActivePinId: (pinId: Id<'mapPins'> | null) => void
  clearMapView: () => void
}

export const useMapViewStore = create<MapViewState & MapViewActions>((set) => ({
  activeMap: null,
  pins: [],
  activePinId: null,

  setActiveMap: (map, pins) => set({ activeMap: map, pins, activePinId: null }),
  setActivePinId: (activePinId) => set({ activePinId }),
  clearMapView: () => set({ activeMap: null, pins: [], activePinId: null }),
}))

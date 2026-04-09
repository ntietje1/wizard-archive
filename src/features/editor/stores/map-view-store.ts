import { create } from 'zustand'
import type { Id } from 'convex/_generated/dataModel'
import type { GameMapWithContent, MapPinWithItem } from 'convex/gameMaps/types'

interface MapViewState {
  activeMap: GameMapWithContent | null
  pins: Array<MapPinWithItem>
  activePinId: Id<'mapPins'> | null
}

interface MapViewActions {
  setActiveMap: (map: GameMapWithContent | null, pins: Array<MapPinWithItem>) => void
  setActivePinId: (pinId: Id<'mapPins'> | null) => void
  clearMapView: () => void
}

export const useMapViewStore = create<MapViewState & MapViewActions>((set) => ({
  activeMap: null,
  pins: [],
  activePinId: null,

  setActiveMap: (map, pins) => set({ activeMap: map, pins, activePinId: null }),
  setActivePinId: (pinId) =>
    set((state) => ({
      activePinId:
        pinId === null || state.pins.some((p) => p._id === pinId) ? pinId : state.activePinId,
    })),
  clearMapView: () => set({ activeMap: null, pins: [], activePinId: null }),
}))

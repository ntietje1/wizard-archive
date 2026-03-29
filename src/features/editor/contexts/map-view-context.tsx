import { useEffect } from 'react'
import type { GameMapWithContent, MapPinWithItem } from 'convex/gameMaps/types'
import { useMapViewStore } from '~/features/editor/stores/map-view-store'

export function MapViewProvider({
  map,
  pins,
  children,
}: {
  map: GameMapWithContent | null
  pins: Array<MapPinWithItem>
  children: React.ReactNode
}) {
  const setActiveMap = useMapViewStore((s) => s.setActiveMap)
  const clearMapView = useMapViewStore((s) => s.clearMapView)

  useEffect(() => {
    setActiveMap(map, pins)
    return () => {
      clearMapView()
    }
  }, [map, pins, setActiveMap, clearMapView])

  return children
}

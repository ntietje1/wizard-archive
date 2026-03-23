import { useMemo, useState } from 'react'
import type { GameMapWithContent, MapPinWithItem } from 'convex/gameMaps/types'
import type { Id } from 'convex/_generated/dataModel'
import { MapViewContext } from '~/features/editor/hooks/useMapView'

export function MapViewProvider({
  map,
  pins,
  children,
}: {
  map: GameMapWithContent | null
  pins: Array<MapPinWithItem>
  children: React.ReactNode
}) {
  const [activePinId, setActivePinId] = useState<Id<'mapPins'> | null>(null)

  const value = useMemo(() => {
    return {
      activeMap: map ?? null,
      activePin: pins.find((pin) => pin._id === activePinId) ?? null,
      setActivePinId: setActivePinId,
    }
  }, [map, pins, activePinId])

  return (
    <MapViewContext.Provider value={value}>{children}</MapViewContext.Provider>
  )
}

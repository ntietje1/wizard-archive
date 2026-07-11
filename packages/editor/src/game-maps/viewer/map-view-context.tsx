import { useRef, useState } from 'react'
import type { MapPinId } from '../../../../../shared/common/ids'
import type { MapItemWithContent, MapPinWithItem } from '../../game-maps/item-contract'
import type { MapPinInteractionRequests, MapPinOperations } from './map-pin-operations'
import { MapViewContext } from './map-view-context-value'

export function MapViewProvider({
  canEditMap,
  canViewPinItem,
  map,
  pins,
  pinOperations,
  requestPinMove,
  requestPinPlacement,
  children,
}: {
  canEditMap: boolean
  canViewPinItem: (pin: MapPinWithItem) => boolean
  map: MapItemWithContent | null
  pins: Array<MapPinWithItem>
  pinOperations: MapPinOperations
  children: React.ReactNode
} & MapPinInteractionRequests) {
  const [activePinId, setActivePinIdValue] = useState<MapPinId | null>(null)
  const activePin = map ? (pins.find((pin) => pin.id === activePinId) ?? null) : null
  const pinsRef = useRef(pins)
  pinsRef.current = pins
  const setActivePinIdRef = useRef<((pinId: MapPinId | null) => void) | null>(null)
  if (!setActivePinIdRef.current) {
    setActivePinIdRef.current = (pinId: MapPinId | null) => {
      setActivePinIdValue((current) =>
        pinId === null || pinsRef.current.some((pin) => pin.id === pinId) ? pinId : current,
      )
    }
  }
  const setActivePinId = setActivePinIdRef.current!

  const pinRequests = useStableValue(
    {
      requestPinMove,
      requestPinPlacement,
    },
    [requestPinMove, requestPinPlacement],
  )
  const value = useStableValue(
    {
      activeMap: map,
      activePin,
      canEditMap,
      canViewPinItem,
      pinOperations,
      pinRequests,
      setActivePinId,
    },
    [activePin, canEditMap, canViewPinItem, map, pinOperations, pinRequests, setActivePinId],
  )

  return <MapViewContext value={value}>{children}</MapViewContext>
}

function useStableValue<TValue>(value: TValue, dependencies: ReadonlyArray<unknown>): TValue {
  const valueRef = useRef<{ dependencies: Array<unknown>; value: TValue } | null>(null)
  if (!valueRef.current || didDependenciesChange(valueRef.current.dependencies, dependencies)) {
    valueRef.current = { dependencies: [...dependencies], value }
  }
  return valueRef.current.value
}

function didDependenciesChange(previous: ReadonlyArray<unknown>, next: ReadonlyArray<unknown>) {
  return (
    previous.length !== next.length ||
    previous.some((value, index) => !Object.is(value, next[index]))
  )
}

import { useCallback, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import { useContextMenu } from '../hooks/useContextMenu'
import { useContextEnhancers } from '../hooks/useContextEnhancers'
import { ContextMenu  } from '../components/ContextMenu'
import { createMenuContext } from '../context'
import type {ContextMenuRef} from '../components/ContextMenu';
import type { MenuContext } from '../types'
import type { Id } from 'convex/_generated/dataModel'

interface PinPosition {
  x: number
  y: number
}

interface MapPinContextMenuProps {
  pinId: Id<'mapPins'>
  mapId: Id<'gameMaps'>
  position: PinPosition
  onClose: () => void
}

export function MapPinContextMenu({
  pinId,
  mapId,
  position,
  onClose,
}: MapPinContextMenuProps) {
  const contextMenuRef = useRef<ContextMenuRef>(null)

  const pinsQuery = useQuery(
    convexQuery(api.gameMaps.queries.getMapPins, { mapId }),
  )
  const pin = pinsQuery.data?.find((p) => p._id === pinId)

  const enhancers = useContextEnhancers()

  const contextMenuHook = useContextMenu({
    viewContext: 'map-view',
    item: pin?.item,
    enhancers,
  })

  const buildContext = useCallback((): MenuContext | null => {
    if (!pin?.item) return null

    const baseContext = contextMenuHook.buildContext(pin.item)
    if (!baseContext) return null

    // Add pin-specific context
    return createMenuContext({
      ...baseContext,
      pinId,
      mapId,
    })
  }, [pin, pinId, mapId, contextMenuHook])

  // Open menu at position when component mounts
  useEffect(() => {
    if (pin) {
      contextMenuRef.current?.open(position)
    }
  }, [pin, position])

  if (!pin) return null

  return (
    <ContextMenu
      ref={contextMenuRef}
      buildContext={buildContext}
      onClose={onClose}
      className="absolute inset-0 pointer-events-none"
    >
      <div className="w-full h-full" />
    </ContextMenu>
  )
}

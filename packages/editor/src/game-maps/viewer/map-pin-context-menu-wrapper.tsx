import { useEffect, useRef } from 'react'
import { WorkspaceContextMenu } from '../../workspace/context-menu/context-menu'
import { useMapView } from './use-map-view'
import type { MapPinWithItem } from '../../game-maps/item-contract'
import type { ContextMenuHostRef } from '../../context-menu/components/host'
import type { PinPosition } from './map-pin-placement'

export function MapPinContextMenuWrapper({
  pin,
  position,
  onClose,
}: {
  pin: MapPinWithItem
  position: PinPosition
  onClose: () => void
}) {
  const contextMenuRef = useRef<ContextMenuHostRef>(null)
  const { setActivePinId } = useMapView()
  const dialogOpenRef = useRef(false)
  const setActivePinIdRef = useRef(setActivePinId)
  const pinId = pin.id

  useEffect(() => {
    setActivePinIdRef.current = setActivePinId
  }, [setActivePinId])

  useEffect(() => {
    dialogOpenRef.current = false
    const setActivePinIdForMenu = setActivePinIdRef.current
    setActivePinIdForMenu(pinId)
    const frameId = window.requestAnimationFrame(() => {
      contextMenuRef.current?.open(position)
    })

    return () => {
      window.cancelAnimationFrame(frameId)
      setActivePinIdForMenu(null)
    }
  }, [pinId, position])

  const handleDialogOpen = () => {
    dialogOpenRef.current = true
  }

  const handleMenuClose = () => {
    if (!dialogOpenRef.current) {
      setActivePinIdRef.current(null)
      onClose()
    }
  }

  const handleDialogClose = () => {
    dialogOpenRef.current = false
    setActivePinIdRef.current(null)
    onClose()
  }

  return (
    <WorkspaceContextMenu
      ref={contextMenuRef}
      viewContext="map-view"
      item={pin.item ?? undefined}
      className="absolute inset-0 pointer-events-none"
      onClose={handleMenuClose}
      onDialogOpen={handleDialogOpen}
      onDialogClose={handleDialogClose}
    >
      <div className="w-full h-full" />
    </WorkspaceContextMenu>
  )
}

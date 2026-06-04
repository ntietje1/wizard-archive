import { useEffect, useRef } from 'react'
import { EditorContextMenu } from '~/features/context-menu/components/editor-context-menu'
import { useMapView } from '~/features/editor/hooks/useMapView'
import type { Id } from 'convex/_generated/dataModel'
import type { MapPinWithItem } from 'shared/game-maps/types'
import type { ContextMenuHostRef } from '~/features/context-menu/components/context-menu-host'
import type { PinPosition } from './map-pin-placement'
import { useCampaignActorPermissions } from '~/features/campaigns/hooks/useCampaignActorPermissions'

export function MapPinContextMenuWrapper({
  pinId,
  pins,
  position,
  onClose,
}: {
  pinId: Id<'mapPins'>
  pins: Array<MapPinWithItem>
  position: PinPosition
  onClose: () => void
}) {
  const contextMenuRef = useRef<ContextMenuHostRef>(null)
  const { setActivePinId } = useMapView()
  const dialogOpenRef = useRef(false)
  const actorPermissions = useCampaignActorPermissions()

  const pin = pins.find((p) => p._id === pinId)

  useEffect(() => {
    if (pin) {
      setActivePinId(pinId)
      contextMenuRef.current?.open(position)
    }
    return () => {
      setActivePinId(null)
    }
  }, [pin, pinId, position, setActivePinId])

  const handleDialogOpen = () => {
    dialogOpenRef.current = true
  }

  const handleMenuClose = () => {
    setActivePinId(null)
    if (!dialogOpenRef.current) {
      onClose()
    }
  }

  const handleDialogClose = () => {
    dialogOpenRef.current = false
    onClose()
  }

  if (!pin) return null

  const canViewItem = pin.item ? actorPermissions.canView(pin.item) : false
  const actionItem =
    canViewItem && pin.item ? actorPermissions.projectActionItem(pin.item) : undefined

  return (
    <EditorContextMenu
      ref={contextMenuRef}
      viewContext="map-view"
      item={actionItem}
      className="absolute inset-0 pointer-events-none"
      onClose={handleMenuClose}
      onDialogOpen={handleDialogOpen}
      onDialogClose={handleDialogClose}
    >
      <div className="w-full h-full" />
    </EditorContextMenu>
  )
}

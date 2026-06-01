import type { Id } from 'convex/_generated/dataModel'
import type { MapPinWithItem } from 'convex/gameMaps/types'

export function MapModeBanners({
  pendingPinItems,
  pendingPinMove,
  draggingPin,
}: {
  pendingPinItems: { itemIds: Array<Id<'sidebarItems'>> } | null
  pendingPinMove: { pinId: Id<'mapPins'> } | null
  draggingPin: { pin: MapPinWithItem } | null
}) {
  let text: string | null = null
  if (pendingPinItems) {
    text =
      pendingPinItems.itemIds.length === 1
        ? 'Click on map to place pin. Press Escape to cancel.'
        : `Click on map to place ${pendingPinItems.itemIds.length} pins. Press Escape to cancel.`
  } else if (pendingPinMove) {
    text = 'Click on map or drag to move pin. Press Escape to cancel.'
  } else if (draggingPin) {
    text = 'Release to move pin. Press Escape to cancel.'
  }
  if (!text) return null

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[2000] bg-primary text-primary-foreground px-4 py-2 rounded-md shadow-lg">
      <p className="text-sm font-medium">{text}</p>
    </div>
  )
}

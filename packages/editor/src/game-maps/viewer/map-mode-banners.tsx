import type { SidebarItemId } from '../../../../../shared/common/ids'
import type { MapPinId } from '../../resources/domain-id'
import type { MapPinWithItem } from '../../game-maps/item-contract'

export function MapModeBanners({
  pendingPinItems,
  pendingPinMove,
  draggingPin,
}: {
  pendingPinItems: { itemIds: Array<SidebarItemId> } | null
  pendingPinMove: { pinId: MapPinId } | null
  draggingPin: { pin: MapPinWithItem } | null
}) {
  let text: string | null = null
  if (pendingPinItems) {
    text =
      pendingPinItems.itemIds.length === 1
        ? 'Click on map to place pin. Press Escape to cancel.'
        : `Click on map to place ${pendingPinItems.itemIds.length} pins. Press Escape to cancel.`
  } else if (draggingPin) {
    text = 'Release to move pin. Press Escape to cancel.'
  } else if (pendingPinMove) {
    text = 'Click on map or drag to move pin. Press Escape to cancel.'
  }
  if (!text) return null

  return (
    <output
      aria-live="polite"
      className="absolute top-16 left-1/2 -translate-x-1/2 z-[2000] bg-primary text-primary-foreground px-4 py-2 rounded-md shadow-lg"
    >
      <span className="text-sm font-medium">{text}</span>
    </output>
  )
}

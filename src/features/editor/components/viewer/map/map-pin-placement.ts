import type { Id } from 'convex/_generated/dataModel'

export interface PinPosition {
  x: number
  y: number
}

const PIN_DROP_OFFSET_STEP_PERCENT = 2
const PIN_DROP_OFFSET_MAX_PER_ROW = 8

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, value))
}

export function buildMapPinPlacementInputs(
  itemIds: Array<Id<'sidebarItems'>>,
  position: PinPosition,
): Array<{ itemId: Id<'sidebarItems'>; x: number; y: number }> {
  return itemIds.map((itemId, index) => {
    const col = index % PIN_DROP_OFFSET_MAX_PER_ROW
    const row = Math.floor(index / PIN_DROP_OFFSET_MAX_PER_ROW)
    const rowSize = Math.min(
      PIN_DROP_OFFSET_MAX_PER_ROW,
      itemIds.length - row * PIN_DROP_OFFSET_MAX_PER_ROW,
    )
    const dx = (col - (rowSize - 1) / 2) * PIN_DROP_OFFSET_STEP_PERCENT
    const dy = row * PIN_DROP_OFFSET_STEP_PERCENT
    return {
      itemId,
      x: clampPercent(position.x + dx),
      y: clampPercent(position.y + dy),
    }
  })
}

export function getImagePinPosition(
  image: HTMLImageElement | null,
  input: { clientX: number; clientY: number },
): PinPosition | null {
  if (!image) return null
  const rect = image.getBoundingClientRect()
  if (
    !Number.isFinite(rect.width) ||
    !Number.isFinite(rect.height) ||
    rect.width <= 0 ||
    rect.height <= 0
  ) {
    return null
  }
  return {
    x: clampPercent(((input.clientX - rect.left) / rect.width) * 100),
    y: clampPercent(((input.clientY - rect.top) / rect.height) * 100),
  }
}

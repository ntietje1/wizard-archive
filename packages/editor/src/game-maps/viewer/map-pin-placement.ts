import type { ResourceId } from '../../resources/domain-id'
export interface PinPosition {
  x: number
  y: number
}

export interface ScreenPosition {
  x: number
  y: number
}

export interface MapPinPlacementInput extends PinPosition {
  itemId: ResourceId
  layerId?: string | null
}

const PIN_DROP_OFFSET_STEP_PERCENT = 2
const PIN_DROP_OFFSET_MAX_PER_ROW = 8
const IMAGE_EDGE_CLICK_TOLERANCE_PERCENT = 0.5

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, value))
}

export function buildMapPinPlacementInputs(
  itemIds: Array<ResourceId>,
  position: PinPosition,
): Array<MapPinPlacementInput> {
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
  const x = ((input.clientX - rect.left) / rect.width) * 100
  const y = ((input.clientY - rect.top) / rect.height) * 100
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null
  if (
    x < -IMAGE_EDGE_CLICK_TOLERANCE_PERCENT ||
    x > 100 + IMAGE_EDGE_CLICK_TOLERANCE_PERCENT ||
    y < -IMAGE_EDGE_CLICK_TOLERANCE_PERCENT ||
    y > 100 + IMAGE_EDGE_CLICK_TOLERANCE_PERCENT
  ) {
    return null
  }
  return { x: clampPercent(x), y: clampPercent(y) }
}

import { assertNever } from '~/shared/utils/utils'

export type CanvasReorderDirection = 'sendToBack' | 'sendBackward' | 'bringForward' | 'bringToFront'

export function reorderCanvasElementIds(
  orderedIds: Array<string>,
  selectedIds: Array<string>,
  direction: CanvasReorderDirection,
) {
  const selectedIdSet = new Set(selectedIds)
  if (selectedIdSet.size === 0) {
    return orderedIds
  }

  switch (direction) {
    case 'sendToBack':
      return [
        ...orderedIds.filter((id) => selectedIdSet.has(id)),
        ...orderedIds.filter((id) => !selectedIdSet.has(id)),
      ]
    case 'bringToFront':
      return [
        ...orderedIds.filter((id) => !selectedIdSet.has(id)),
        ...orderedIds.filter((id) => selectedIdSet.has(id)),
      ]
    case 'sendBackward': {
      const moved = [...orderedIds]
      for (let index = 1; index < moved.length; index += 1) {
        if (selectedIdSet.has(moved[index]) && !selectedIdSet.has(moved[index - 1])) {
          ;[moved[index - 1], moved[index]] = [moved[index], moved[index - 1]]
        }
      }
      return moved
    }
    case 'bringForward': {
      const moved = [...orderedIds]
      for (let index = moved.length - 2; index >= 0; index -= 1) {
        if (selectedIdSet.has(moved[index]) && !selectedIdSet.has(moved[index + 1])) {
          ;[moved[index], moved[index + 1]] = [moved[index + 1], moved[index]]
        }
      }
      return moved
    }
    default:
      return assertNever(direction)
  }
}

import { assertNever } from '~/shared/utils/utils'

export type CanvasReorderDirection = 'sendToBack' | 'sendBackward' | 'bringForward' | 'bringToFront'

export function reorderCanvasElementIds(
  orderedIds: Array<string>,
  selectedIds: ReadonlySet<string>,
  direction: CanvasReorderDirection,
) {
  if (selectedIds.size === 0) {
    return orderedIds
  }

  switch (direction) {
    case 'sendToBack':
      return [
        ...orderedIds.filter((id) => selectedIds.has(id)),
        ...orderedIds.filter((id) => !selectedIds.has(id)),
      ]
    case 'bringToFront':
      return [
        ...orderedIds.filter((id) => !selectedIds.has(id)),
        ...orderedIds.filter((id) => selectedIds.has(id)),
      ]
    case 'sendBackward': {
      const moved = [...orderedIds]
      for (let index = 1; index < moved.length; index += 1) {
        if (selectedIds.has(moved[index]) && !selectedIds.has(moved[index - 1])) {
          ;[moved[index - 1], moved[index]] = [moved[index], moved[index - 1]]
        }
      }
      return moved
    }
    case 'bringForward': {
      const moved = [...orderedIds]
      for (let index = moved.length - 2; index >= 0; index -= 1) {
        if (selectedIds.has(moved[index]) && !selectedIds.has(moved[index + 1])) {
          ;[moved[index], moved[index + 1]] = [moved[index + 1], moved[index]]
        }
      }
      return moved
    }
    default:
      return assertNever(direction)
  }
}

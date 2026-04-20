type OrderableCanvasElement = {
  id: string
  zIndex?: number
}

export type CanvasReorderDirection = 'sendToBack' | 'sendBackward' | 'bringForward' | 'bringToFront'

function sortByZIndex<T extends OrderableCanvasElement>(elements: Array<T>) {
  return elements
    .map((element, index) => ({ element, index }))
    .sort((a, b) => {
      const aOrder = a.element.zIndex ?? a.index
      const bOrder = b.element.zIndex ?? b.index
      return aOrder - bOrder
    })
    .map(({ element }) => element)
}

function normalizeZIndex<T extends OrderableCanvasElement>(elements: Array<T>) {
  return elements.map((element, index) => ({
    ...element,
    zIndex: index + 1,
  }))
}

export function getOrderedCanvasElements<T extends OrderableCanvasElement>(elements: Array<T>) {
  return normalizeZIndex(sortByZIndex(elements))
}

export function getNextCanvasElementZIndex<T extends OrderableCanvasElement>(elements: Array<T>) {
  if (elements.length === 0) {
    return 1
  }

  return Math.max(...elements.map((element, index) => element.zIndex ?? index + 1)) + 1
}

export function reorderCanvasElements<T extends OrderableCanvasElement>(
  elements: Array<T>,
  selectedIds: Array<string>,
  direction: CanvasReorderDirection,
) {
  const selectedIdSet = new Set(selectedIds)
  const ordered = sortByZIndex(elements)

  if (selectedIdSet.size === 0) {
    return normalizeZIndex(ordered)
  }

  switch (direction) {
    case 'sendToBack':
      return normalizeZIndex([
        ...ordered.filter((element) => selectedIdSet.has(element.id)),
        ...ordered.filter((element) => !selectedIdSet.has(element.id)),
      ])
    case 'bringToFront':
      return normalizeZIndex([
        ...ordered.filter((element) => !selectedIdSet.has(element.id)),
        ...ordered.filter((element) => selectedIdSet.has(element.id)),
      ])
    case 'sendBackward': {
      const moved = [...ordered]
      for (let index = 1; index < moved.length; index += 1) {
        if (selectedIdSet.has(moved[index].id) && !selectedIdSet.has(moved[index - 1].id)) {
          ;[moved[index - 1], moved[index]] = [moved[index], moved[index - 1]]
        }
      }
      return normalizeZIndex(moved)
    }
    case 'bringForward': {
      const moved = [...ordered]
      for (let index = moved.length - 2; index >= 0; index -= 1) {
        if (selectedIdSet.has(moved[index].id) && !selectedIdSet.has(moved[index + 1].id)) {
          ;[moved[index], moved[index + 1]] = [moved[index + 1], moved[index]]
        }
      }
      return normalizeZIndex(moved)
    }
  }
}

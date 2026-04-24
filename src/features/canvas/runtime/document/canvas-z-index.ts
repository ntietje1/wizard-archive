import type { OrderableCanvasElement } from './canvas-z-order'

export function getNextCanvasElementZIndex<T extends OrderableCanvasElement>(elements: Array<T>) {
  if (elements.length === 0) {
    return 1
  }

  let maxZIndex = elements[0].zIndex ?? 0

  for (let index = 1; index < elements.length; index += 1) {
    maxZIndex = Math.max(maxZIndex, elements[index].zIndex ?? index)
  }

  return maxZIndex + 1
}

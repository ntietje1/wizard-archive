export type OrderableCanvasElement = {
  id: string
  zIndex?: number
}

export function sortCanvasElementsByZIndex<T extends OrderableCanvasElement>(elements: Array<T>) {
  return elements
    .map((element, index) => ({ element, index }))
    .sort((a, b) => {
      const aOrder = a.element.zIndex ?? a.index
      const bOrder = b.element.zIndex ?? b.index
      return aOrder === bOrder ? a.index - b.index : aOrder - bOrder
    })
    .map(({ element }) => element)
}

export function applyCanvasZOrder<T extends OrderableCanvasElement>(
  elements: Array<T>,
  orderedIds: Array<string>,
) {
  const elementsById = new Map(elements.map((element) => [element.id, element]))

  return orderedIds.flatMap((id, index) => {
    const element = elementsById.get(id)
    return element ? [{ ...element, zIndex: index + 1 }] : []
  })
}

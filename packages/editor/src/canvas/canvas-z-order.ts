import type {
  CanvasDocumentChange,
  CanvasDocumentEdgeUpdate,
  CanvasDocumentNodeUpdate,
} from './document-controller'
import type {
  CanvasDocumentContent,
  CanvasDocumentEdge,
  CanvasDocumentNode,
} from './document-contract'
import type { CanvasSelection } from './interaction-types'
import { canvasSelectionWithinWorkload } from './workload'

export const CANVAS_REORDER_ACTIONS = [
  { id: 'sendToBack', label: 'Send to back' },
  { id: 'sendBackward', label: 'Send backward' },
  { id: 'bringForward', label: 'Bring forward' },
  { id: 'bringToFront', label: 'Bring to front' },
] as const

type CanvasReorderDirection = (typeof CANVAS_REORDER_ACTIONS)[number]['id']

type CanvasOrderedElement =
  | Readonly<{ key: string; kind: 'node'; value: CanvasDocumentNode; zIndex?: number }>
  | Readonly<{ key: string; kind: 'edge'; value: CanvasDocumentEdge; zIndex?: number }>

export function createCanvasReorderChange(
  content: CanvasDocumentContent,
  selection: CanvasSelection,
  direction: CanvasReorderDirection,
): CanvasDocumentChange | null {
  if (!canvasSelectionWithinWorkload(selection)) return null
  const elements = sortCanvasElements([
    ...content.nodes.map((value) => ({
      key: `node:${value.id}`,
      kind: 'node' as const,
      value,
      zIndex: value.zIndex,
    })),
    ...content.edges.map((value) => ({
      key: `edge:${value.id}`,
      kind: 'edge' as const,
      value,
      zIndex: value.zIndex,
    })),
  ])
  const requested = new Set([
    ...Array.from(selection.nodeIds, (id) => `node:${id}`),
    ...Array.from(selection.edgeIds, (id) => `edge:${id}`),
  ])
  const selected = new Set(
    elements.flatMap((element) => (requested.has(element.key) ? [element.key] : [])),
  )
  if (selected.size === 0) return null
  const updates = reorderCanvasElements(elements, selected, direction)
  const nodes: Array<CanvasDocumentNodeUpdate> = []
  const edges: Array<CanvasDocumentEdgeUpdate> = []
  updates.forEach(({ element, zIndex }) => {
    if (element.value.zIndex === zIndex) return
    if (element.kind === 'node') {
      nodes.push({ id: element.value.id, type: element.value.type, zIndex })
    } else {
      edges.push({ id: element.value.id, zIndex })
    }
  })
  return nodes.length > 0 || edges.length > 0 ? { type: 'update', nodes, edges } : null
}

function sortCanvasElements<TElement extends Readonly<{ zIndex?: number }>>(
  elements: ReadonlyArray<TElement & Readonly<{ key: string }>>,
): Array<TElement & Readonly<{ key: string }>> {
  return elements
    .map((element, index) => ({ element, index }))
    .sort((left, right) => {
      const leftOrder = left.element.zIndex ?? left.index
      const rightOrder = right.element.zIndex ?? right.index
      return leftOrder === rightOrder
        ? left.element.key.localeCompare(right.element.key)
        : leftOrder - rightOrder
    })
    .map(({ element }) => element)
}

function reorderCanvasElements(
  elements: ReadonlyArray<CanvasOrderedElement>,
  selected: ReadonlySet<string>,
  direction: CanvasReorderDirection,
): Array<Readonly<{ element: CanvasOrderedElement; zIndex: number }>> {
  if (direction === 'sendToBack' || direction === 'bringToFront') {
    return moveCanvasElementsToBoundary(elements, selected, direction)
  }
  return moveCanvasElementsOneLayer(elements, selected, direction === 'sendBackward' ? -1 : 1)
}

function moveCanvasElementsToBoundary(
  elements: ReadonlyArray<CanvasOrderedElement>,
  selected: ReadonlySet<string>,
  direction: 'bringToFront' | 'sendToBack',
): Array<Readonly<{ element: CanvasOrderedElement; zIndex: number }>> {
  const selectedElements = elements.filter((element) => selected.has(element.key))
  const boundary =
    direction === 'sendToBack'
      ? elements.slice(0, selectedElements.length)
      : elements.slice(-selectedElements.length)
  if (boundary.every((element) => selected.has(element.key))) return []
  const outsideOrder = elements.reduce((value, element, index) => {
    const order = element.zIndex ?? index
    return direction === 'sendToBack' ? Math.min(value, order) : Math.max(value, order)
  }, 0)
  const firstOrder =
    direction === 'sendToBack' ? outsideOrder - selectedElements.length : outsideOrder + 1
  return selectedElements.map((element, index) => ({
    element,
    zIndex: firstOrder + index,
  }))
}

function moveCanvasElementsOneLayer(
  elements: ReadonlyArray<CanvasOrderedElement>,
  selected: ReadonlySet<string>,
  step: -1 | 1,
): Array<Readonly<{ element: CanvasOrderedElement; zIndex: number }>> {
  const reordered = [...elements]
  const updates = new Map<string, Readonly<{ element: CanvasOrderedElement; zIndex: number }>>()
  let index = step === -1 ? 1 : reordered.length - 2
  while (index >= 0 && index < reordered.length) {
    const neighborIndex = index + step
    const element = reordered[index]!
    const neighbor = reordered[neighborIndex]!
    if (selected.has(element.key) && !selected.has(neighbor.key)) {
      updates.set(element.key, {
        element,
        zIndex: neighbor.zIndex ?? neighborIndex,
      })
      updates.set(neighbor.key, {
        element: neighbor,
        zIndex: element.zIndex ?? index,
      })
      ;[reordered[index], reordered[neighborIndex]] = [neighbor, element]
    }
    index -= step
  }
  return elements.flatMap((element) => {
    const update = updates.get(element.key)
    return update ? [update] : []
  })
}

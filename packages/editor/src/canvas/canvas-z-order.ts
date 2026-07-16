import type { CanvasDocumentChange } from './document-controller'
import type {
  CanvasDocumentContent,
  CanvasDocumentEdge,
  CanvasDocumentNode,
} from './document-contract'
import type { CanvasSelection } from './interaction-controller'

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
  const ordered = reorderCanvasElements(elements, selected, direction)
  const nodes: Array<CanvasDocumentNode> = []
  const edges: Array<CanvasDocumentEdge> = []
  ordered.forEach((element, index) => {
    const zIndex = index + 1
    if (element.value.zIndex === zIndex) return
    if (element.kind === 'node') nodes.push({ ...element.value, zIndex })
    else edges.push({ ...element.value, zIndex })
  })
  return nodes.length > 0 || edges.length > 0 ? { type: 'replace', nodes, edges } : null
}

function sortCanvasElements<TElement extends Readonly<{ zIndex?: number }>>(
  elements: ReadonlyArray<TElement>,
): Array<TElement> {
  return elements
    .map((element, index) => ({ element, index }))
    .sort((left, right) => {
      const leftOrder = left.element.zIndex ?? left.index
      const rightOrder = right.element.zIndex ?? right.index
      return leftOrder === rightOrder ? left.index - right.index : leftOrder - rightOrder
    })
    .map(({ element }) => element)
}

function reorderCanvasElements(
  elements: ReadonlyArray<CanvasOrderedElement>,
  selected: ReadonlySet<string>,
  direction: CanvasReorderDirection,
): Array<CanvasOrderedElement> {
  if (direction === 'sendToBack') {
    return [
      ...elements.filter((element) => selected.has(element.key)),
      ...elements.filter((element) => !selected.has(element.key)),
    ]
  }
  if (direction === 'bringToFront') {
    return [
      ...elements.filter((element) => !selected.has(element.key)),
      ...elements.filter((element) => selected.has(element.key)),
    ]
  }
  const reordered = [...elements]
  if (direction === 'sendBackward') {
    for (let index = 1; index < reordered.length; index += 1) {
      if (selected.has(reordered[index]!.key) && !selected.has(reordered[index - 1]!.key)) {
        ;[reordered[index - 1], reordered[index]] = [reordered[index]!, reordered[index - 1]!]
      }
    }
    return reordered
  }
  for (let index = reordered.length - 2; index >= 0; index -= 1) {
    if (selected.has(reordered[index]!.key) && !selected.has(reordered[index + 1]!.key)) {
      ;[reordered[index], reordered[index + 1]] = [reordered[index + 1]!, reordered[index]!]
    }
  }
  return reordered
}

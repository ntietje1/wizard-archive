import type { CanvasDocumentChange } from './document-controller'
import { stripEphemeralCanvasNodeState } from './document-contract'
import type {
  CanvasDocumentContent,
  CanvasDocumentEdge,
  CanvasDocumentNode,
} from './document-contract'
import type { CanvasSelection } from './interaction-types'
import { canvasContentWithinWorkload, canvasSelectionWithinWorkload } from './workload'
import { duplicateCanvasTextDocument } from './text/model'
import { DOMAIN_ID_KIND, generateDomainId, generateUuidV7 } from '../resources/domain-id'
import type { CanvasNodeId } from '../resources/domain-id'

const CANVAS_PASTE_OFFSET = 32

export type CanvasClipboardEntry = Readonly<{
  nodes: ReadonlyArray<CanvasDocumentNode>
  edges: ReadonlyArray<CanvasDocumentEdge>
  pasteCount: number
}>

type CanvasPaste = Readonly<{
  change: Extract<CanvasDocumentChange, { type: 'insert' }>
  nextClipboard: CanvasClipboardEntry
  selection: CanvasSelection
}>

export function captureCanvasSelection(
  content: CanvasDocumentContent,
  selection: CanvasSelection,
): CanvasClipboardEntry | null {
  if (!canvasSelectionWithinWorkload(selection)) return null
  const nodes = sortCanvasElements(content.nodes.filter((node) => selection.nodeIds.has(node.id)))
  if (nodes.length === 0) return null
  const nodeIds = new Set(nodes.map((node) => node.id))
  const edges = sortCanvasElements(
    content.edges.filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target)),
  )
  return {
    nodes: nodes.map(cloneCanvasNode),
    edges: edges.map(cloneCanvasEdge),
    pasteCount: 0,
  }
}

export function materializeCanvasPaste(
  content: CanvasDocumentContent,
  clipboard: CanvasClipboardEntry,
): CanvasPaste | null {
  if (
    clipboard.nodes.length === 0 ||
    !Number.isSafeInteger(clipboard.pasteCount) ||
    clipboard.pasteCount < 0
  ) {
    return null
  }
  const nodeIdMap = new Map<CanvasNodeId, CanvasNodeId>()
  const offset = CANVAS_PASTE_OFFSET * (clipboard.pasteCount + 1)
  const nextZIndex = highestCanvasZIndex(content) + 1
  const elementOrder = new Map(
    sortCanvasElements([
      ...clipboard.nodes.map((node) => ({ id: `node:${node.id}`, zIndex: node.zIndex })),
      ...clipboard.edges.map((edge) => ({ id: `edge:${edge.id}`, zIndex: edge.zIndex })),
    ]).map((element, index) => [element.id, nextZIndex + index]),
  )
  const nodes: Array<CanvasDocumentNode> = clipboard.nodes.map((node): CanvasDocumentNode => {
    const id = generateDomainId(DOMAIN_ID_KIND.canvasNode)
    nodeIdMap.set(node.id, id)
    const duplicate = cloneCanvasNode(node)
    if (duplicate.type === 'text' && duplicate.data.content) {
      duplicate.data.content = duplicateCanvasTextDocument(duplicate.data.content)
    }
    return {
      ...duplicate,
      id,
      position: { x: node.position.x + offset, y: node.position.y + offset },
      zIndex: elementOrder.get(`node:${node.id}`),
    }
  })
  const edges = clipboard.edges.flatMap((edge) => {
    const source = nodeIdMap.get(edge.source)
    const target = nodeIdMap.get(edge.target)
    if (!source || !target) return []
    return [
      {
        ...cloneCanvasEdge(edge),
        id: generateUuidV7(),
        source,
        target,
        zIndex: elementOrder.get(`edge:${edge.id}`),
      },
    ]
  })
  if (
    !canvasContentWithinWorkload({
      nodes: [...content.nodes, ...nodes],
      edges: [...content.edges, ...edges],
    })
  ) {
    return null
  }
  return {
    change: { type: 'insert', nodes, edges },
    nextClipboard: { ...clipboard, pasteCount: clipboard.pasteCount + 1 },
    selection: {
      nodeIds: new Set(nodes.map((node) => node.id)),
      edgeIds: new Set(edges.map((edge) => edge.id)),
    },
  }
}

function cloneCanvasNode(node: CanvasDocumentNode): CanvasDocumentNode {
  return structuredClone(stripEphemeralCanvasNodeState(node))
}

function cloneCanvasEdge(edge: CanvasDocumentEdge): CanvasDocumentEdge {
  return structuredClone(edge)
}

function sortCanvasElements<TElement extends Readonly<{ id: string; zIndex?: number }>>(
  elements: ReadonlyArray<TElement>,
): Array<TElement> {
  return elements
    .map((element, index) => ({ element, index }))
    .sort((left, right) => {
      const order = (left.element.zIndex ?? left.index) - (right.element.zIndex ?? right.index)
      return order === 0 ? left.element.id.localeCompare(right.element.id) : order
    })
    .map(({ element }) => element)
}

function highestCanvasZIndex(content: CanvasDocumentContent): number {
  return [...content.nodes, ...content.edges].reduce(
    (highest, element, index) => Math.max(highest, element.zIndex ?? index),
    -1,
  )
}

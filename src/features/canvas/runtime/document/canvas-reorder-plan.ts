import { reorderCanvasElementIds } from './canvas-reorder'
import { sortCanvasElementsByZIndex } from './canvas-z-order'
import { stripEphemeralCanvasNodeState } from '../../utils/canvas-node-persistence'
import type { CanvasSelectionSnapshot } from '../../system/canvas-selection'
import type { CanvasReorderDirection } from './canvas-reorder'
import type { CanvasDocumentEdge, CanvasDocumentNode } from 'convex/canvases/validation'
import type * as Y from 'yjs'

export interface CanvasReorderPlan {
  nodes: Array<CanvasDocumentNode> | null
  edges: Array<CanvasDocumentEdge> | null
}

type MixedCanvasElement =
  | { id: string; kind: 'node'; node: CanvasDocumentNode; zIndex?: number }
  | { id: string; kind: 'edge'; edge: CanvasDocumentEdge; zIndex?: number }

function getCurrentCanvasNodes(nodesMap: Y.Map<CanvasDocumentNode>): Array<CanvasDocumentNode> {
  return sortCanvasElementsByZIndex(
    Array.from(nodesMap.values()).map((node) => stripEphemeralCanvasNodeState(node)),
  )
}

function getCurrentCanvasEdges(edgesMap: Y.Map<CanvasDocumentEdge>): Array<CanvasDocumentEdge> {
  return sortCanvasElementsByZIndex(Array.from(edgesMap.values()))
}

export function createCanvasReorderPlan(
  nodesMap: Y.Map<CanvasDocumentNode>,
  edgesMap: Y.Map<CanvasDocumentEdge>,
  selection: CanvasSelectionSnapshot,
  direction: CanvasReorderDirection,
): CanvasReorderPlan | null {
  if (selection.nodeIds.size === 0 && selection.edgeIds.size === 0) {
    return null
  }

  const currentNodes = getCurrentCanvasNodes(nodesMap)
  const currentEdges = getCurrentCanvasEdges(edgesMap)
  const currentElements = sortCanvasElementsByZIndex([
    ...currentNodes.map(
      (node): MixedCanvasElement => ({
        id: getMixedCanvasElementId('node', node.id),
        kind: 'node',
        node,
        zIndex: node.zIndex,
      }),
    ),
    ...currentEdges.map(
      (edge): MixedCanvasElement => ({
        id: getMixedCanvasElementId('edge', edge.id),
        kind: 'edge',
        edge,
        zIndex: edge.zIndex,
      }),
    ),
  ])
  const selectedIds = new Set([
    ...Array.from(selection.nodeIds, (id) => getMixedCanvasElementId('node', id)),
    ...Array.from(selection.edgeIds, (id) => getMixedCanvasElementId('edge', id)),
  ])
  const reorderedIds = reorderCanvasElementIds(
    currentElements.map((element) => element.id),
    selectedIds,
    direction,
  )
  const nextZIndexById = new Map(reorderedIds.map((id, index) => [id, index + 1]))

  return {
    nodes: sortCanvasElementsByZIndex(
      currentNodes.map((node) => ({
        ...node,
        zIndex: getNextReorderedZIndex(nextZIndexById, 'node', node.id),
      })),
    ),
    edges: sortCanvasElementsByZIndex(
      currentEdges.map((edge) => ({
        ...edge,
        zIndex: getNextReorderedZIndex(nextZIndexById, 'edge', edge.id),
      })),
    ),
  }
}

function getMixedCanvasElementId(kind: MixedCanvasElement['kind'], id: string) {
  return `${kind}:${id}`
}

function getNextReorderedZIndex(
  nextZIndexById: ReadonlyMap<string, number>,
  kind: MixedCanvasElement['kind'],
  id: string,
) {
  const mixedId = getMixedCanvasElementId(kind, id)
  const zIndex = nextZIndexById.get(mixedId)
  if (zIndex === undefined) {
    throw new Error(`Missing reordered z-index for ${mixedId} (${id})`)
  }
  return zIndex
}

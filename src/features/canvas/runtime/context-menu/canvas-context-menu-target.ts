import { normalizeCanvasEdge } from '../../edges/canvas-edge-registry'
import { normalizeCanvasNode } from '../../nodes/canvas-node-modules'
import { embedNodeContextMenuContributors } from '../../nodes/embed/embed-node-context-menu'
import type { CanvasSelectionSnapshot } from '../../system/canvas-selection'
import type {
  CanvasContextMenuContributor,
  CanvasContextMenuTarget,
} from './canvas-context-menu-types'
import type { CanvasDocumentEdge, CanvasDocumentNode } from 'convex/canvases/validation'
import type * as Y from 'yjs'

type CanvasResolvedContextMenuTarget = {
  target: CanvasContextMenuTarget
  contributors: ReadonlyArray<CanvasContextMenuContributor>
}

function getOrderedNormalizedSelectedNodes(
  nodeIds: ReadonlySet<string>,
  nodesMap: Y.Map<CanvasDocumentNode>,
): Array<NonNullable<ReturnType<typeof normalizeCanvasNode>>> {
  return Array.from(nodeIds)
    .map((nodeId) => nodesMap.get(nodeId))
    .filter((node): node is CanvasDocumentNode => node !== undefined)
    .map((node) => normalizeCanvasNode(node))
    .filter((node): node is NonNullable<ReturnType<typeof normalizeCanvasNode>> => node !== null)
}

function getOrderedNormalizedSelectedEdges(
  edgeIds: ReadonlySet<string>,
  edgesMap: Y.Map<CanvasDocumentEdge>,
): Array<NonNullable<ReturnType<typeof normalizeCanvasEdge>>> {
  return Array.from(edgeIds)
    .map((edgeId) => edgesMap.get(edgeId))
    .filter((edge): edge is CanvasDocumentEdge => edge !== undefined)
    .map((edge) => normalizeCanvasEdge(edge))
    .filter((edge): edge is NonNullable<ReturnType<typeof normalizeCanvasEdge>> => edge !== null)
}

function getSharedValue<TItem, TValue>(
  items: ReadonlyArray<TItem>,
  getValue: (item: TItem) => TValue,
): TValue | null {
  let sharedValue: TValue | null = null
  let hasValue = false
  for (const item of items) {
    const value = getValue(item)
    if (!hasValue) {
      sharedValue = value
      hasValue = true
      continue
    }
    if (value !== sharedValue) {
      return null
    }
  }

  return sharedValue
}

function resolveNodeSelectionTarget(
  selection: CanvasSelectionSnapshot,
  nodesMap: Y.Map<CanvasDocumentNode>,
): CanvasResolvedContextMenuTarget {
  const selectedNodes = getOrderedNormalizedSelectedNodes(selection.nodeIds, nodesMap)

  if (selectedNodes.length === 1) {
    const [selectedNode] = selectedNodes
    if (selectedNode.type === 'embed' && selectedNode.data.sidebarItemId) {
      return {
        target: {
          kind: 'embed-node',
          nodeId: selectedNode.id,
          nodeType: 'embed',
          sidebarItemId: selectedNode.data.sidebarItemId,
        },
        contributors: embedNodeContextMenuContributors,
      }
    }
  }

  const nodeType = getSharedValue(selectedNodes, (node) => node.type)
  return {
    target: {
      kind: 'node-selection',
      nodeIds: selectedNodes.map((node) => node.id),
      nodeType,
    },
    contributors: [],
  }
}

function resolveEdgeSelectionTarget(
  selection: CanvasSelectionSnapshot,
  edgesMap: Y.Map<CanvasDocumentEdge>,
): CanvasResolvedContextMenuTarget {
  const selectedEdges = getOrderedNormalizedSelectedEdges(selection.edgeIds, edgesMap)
  const edgeType = getSharedValue(selectedEdges, (edge) => edge.type)

  return {
    target: {
      kind: 'edge-selection',
      edgeIds: selectedEdges.map((edge) => edge.id),
      edgeType,
    },
    contributors: [],
  }
}

export function resolveCanvasContextMenuTarget(
  selection: CanvasSelectionSnapshot,
  nodesMap: Y.Map<CanvasDocumentNode>,
  edgesMap: Y.Map<CanvasDocumentEdge>,
): CanvasResolvedContextMenuTarget {
  if (selection.nodeIds.size === 0 && selection.edgeIds.size === 0) {
    return { target: { kind: 'pane' }, contributors: [] }
  }

  if (selection.nodeIds.size > 0 && selection.edgeIds.size > 0) {
    const selectedNodes = getOrderedNormalizedSelectedNodes(selection.nodeIds, nodesMap)
    const selectedEdges = getOrderedNormalizedSelectedEdges(selection.edgeIds, edgesMap)
    return {
      target: {
        kind: 'mixed-selection',
        nodeIds: selectedNodes.map((node) => node.id),
        edgeIds: selectedEdges.map((edge) => edge.id),
      },
      contributors: [],
    }
  }

  if (selection.nodeIds.size > 0) {
    return resolveNodeSelectionTarget(selection, nodesMap)
  }

  return resolveEdgeSelectionTarget(selection, edgesMap)
}

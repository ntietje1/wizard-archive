import { embedNodeContextMenuContributors } from '../../nodes/embed/embed-node-context-menu'
import type { CanvasSelectionSnapshot } from '../../system/canvas-selection'
import type { CanvasEngineSnapshot } from '../../system/canvas-engine-types'
import type { Id } from 'convex/_generated/dataModel'
import type {
  CanvasContextMenuContributor,
  CanvasContextMenuTarget,
} from './canvas-context-menu-types'
import type {
  CanvasDocumentEdge,
  CanvasDocumentNode,
} from '~/features/canvas/domain/canvas-document'

type CanvasResolvedContextMenuTarget = {
  target: CanvasContextMenuTarget
  contributors: ReadonlyArray<CanvasContextMenuContributor>
}

function getOrderedSelectedNodes(
  nodeIds: ReadonlySet<string>,
  nodeLookup: CanvasEngineSnapshot['nodeLookup'],
): Array<CanvasDocumentNode> {
  return Array.from(nodeIds)
    .map((nodeId) => nodeLookup.get(nodeId)?.node)
    .filter((node): node is CanvasDocumentNode => node !== undefined)
}

function getOrderedSelectedEdges(
  edgeIds: ReadonlySet<string>,
  edgeLookup: CanvasEngineSnapshot['edgeLookup'],
): Array<CanvasDocumentEdge> {
  return Array.from(edgeIds)
    .map((edgeId) => edgeLookup.get(edgeId)?.edge)
    .filter((edge): edge is CanvasDocumentEdge => edge !== undefined)
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
  snapshot: CanvasEngineSnapshot,
): CanvasResolvedContextMenuTarget {
  const selectedNodes = getOrderedSelectedNodes(selection.nodeIds, snapshot.nodeLookup)

  if (selectedNodes.length === 1) {
    const [selectedNode] = selectedNodes
    if (selectedNode.type === 'embed' && selectedNode.data.sidebarItemId) {
      return {
        target: {
          kind: 'embed-node',
          nodeId: selectedNode.id,
          nodeType: 'embed',
          sidebarItemId: selectedNode.data.sidebarItemId as Id<'sidebarItems'>,
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
  snapshot: CanvasEngineSnapshot,
): CanvasResolvedContextMenuTarget {
  const selectedEdges = getOrderedSelectedEdges(selection.edgeIds, snapshot.edgeLookup)
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
  snapshot: CanvasEngineSnapshot,
): CanvasResolvedContextMenuTarget {
  if (selection.nodeIds.size === 0 && selection.edgeIds.size === 0) {
    return { target: { kind: 'pane' }, contributors: [] }
  }

  if (selection.nodeIds.size > 0 && selection.edgeIds.size > 0) {
    const selectedNodes = getOrderedSelectedNodes(selection.nodeIds, snapshot.nodeLookup)
    const selectedEdges = getOrderedSelectedEdges(selection.edgeIds, snapshot.edgeLookup)
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
    return resolveNodeSelectionTarget(selection, snapshot)
  }

  return resolveEdgeSelectionTarget(selection, snapshot)
}

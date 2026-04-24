import { canvasEdgeSpecs, normalizeCanvasEdge } from '../../edges/canvas-edge-registry'
import { canvasNodeSpecs, normalizeCanvasNode } from '../../nodes/canvas-node-modules'
import type { CanvasSelectionSnapshot } from '../../tools/canvas-tool-types'
import type {
  CanvasContextMenuContributor,
  CanvasContextMenuTarget,
} from './canvas-context-menu-types'
import type { Edge, Node } from '@xyflow/react'
import type * as Y from 'yjs'

type CanvasResolvedContextMenuTarget = {
  target: CanvasContextMenuTarget
  contributors: ReadonlyArray<CanvasContextMenuContributor>
}

function getNormalizedSelectedNodes(
  nodeIds: Array<string>,
  nodesMap: Y.Map<Node>,
): Array<NonNullable<ReturnType<typeof normalizeCanvasNode>>> {
  return nodeIds
    .map((nodeId) => nodesMap.get(nodeId))
    .filter((node): node is Node => node !== undefined)
    .map((node) => normalizeCanvasNode(node))
    .filter((node): node is NonNullable<ReturnType<typeof normalizeCanvasNode>> => node !== null)
}

function getNormalizedSelectedEdges(
  edgeIds: Array<string>,
  edgesMap: Y.Map<Edge>,
): Array<NonNullable<ReturnType<typeof normalizeCanvasEdge>>> {
  return edgeIds
    .map((edgeId) => edgesMap.get(edgeId))
    .filter((edge): edge is Edge => edge !== undefined)
    .map((edge) => normalizeCanvasEdge(edge))
    .filter((edge): edge is NonNullable<ReturnType<typeof normalizeCanvasEdge>> => edge !== null)
}

function resolveNodeSelectionTarget(
  selection: CanvasSelectionSnapshot,
  nodesMap: Y.Map<Node>,
): CanvasResolvedContextMenuTarget {
  const selectedNodes = getNormalizedSelectedNodes(selection.nodeIds, nodesMap)

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
        contributors: canvasNodeSpecs.embed.contextMenuContributors,
      }
    }
  }

  const nodeTypes = new Set(selectedNodes.map((node) => node.type))
  const nodeType = nodeTypes.size === 1 ? (Array.from(nodeTypes)[0] ?? null) : null
  return {
    target: {
      kind: 'node-selection',
      nodeIds: selectedNodes.map((node) => node.id),
      nodeType,
    },
    contributors: nodeType ? canvasNodeSpecs[nodeType].contextMenuContributors : [],
  }
}

function resolveEdgeSelectionTarget(
  selection: CanvasSelectionSnapshot,
  edgesMap: Y.Map<Edge>,
): CanvasResolvedContextMenuTarget {
  const selectedEdges = getNormalizedSelectedEdges(selection.edgeIds, edgesMap)
  const edgeTypes = new Set(selectedEdges.map((edge) => edge.type))
  const edgeType = edgeTypes.size === 1 ? (Array.from(edgeTypes)[0] ?? null) : null

  return {
    target: {
      kind: 'edge-selection',
      edgeIds: selectedEdges.map((edge) => edge.id),
      edgeType,
    },
    contributors: edgeType ? canvasEdgeSpecs[edgeType].contextMenuContributors : [],
  }
}

export function resolveCanvasContextMenuTarget(
  selection: CanvasSelectionSnapshot,
  nodesMap: Y.Map<Node>,
  edgesMap: Y.Map<Edge>,
): CanvasResolvedContextMenuTarget {
  if (selection.nodeIds.length === 0 && selection.edgeIds.length === 0) {
    return { target: { kind: 'pane' }, contributors: [] }
  }

  if (selection.nodeIds.length > 0 && selection.edgeIds.length > 0) {
    return {
      target: { kind: 'mixed-selection', nodeIds: selection.nodeIds, edgeIds: selection.edgeIds },
      contributors: [],
    }
  }

  if (selection.nodeIds.length > 0) {
    return resolveNodeSelectionTarget(selection, nodesMap)
  }

  return resolveEdgeSelectionTarget(selection, edgesMap)
}

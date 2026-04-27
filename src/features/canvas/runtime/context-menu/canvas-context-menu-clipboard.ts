import { getNextCanvasElementZIndex } from '../document/canvas-z-index'
import { sortCanvasElementsByZIndex } from '../document/canvas-z-order'
import { stripEphemeralCanvasNodeState } from '../../utils/canvas-node-persistence'
import type { CanvasClipboardEntry } from './canvas-context-menu-types'
import type { CanvasSelectionSnapshot } from '../../tools/canvas-tool-types'
import type {
  CanvasEdge as Edge,
  CanvasNode as Node,
} from '~/features/canvas/types/canvas-domain-types'
import type * as Y from 'yjs'

const CANVAS_PASTE_OFFSET = 32

interface MaterializedCanvasPaste {
  nodes: Array<Node>
  edges: Array<Edge>
  selection: CanvasSelectionSnapshot
}

function cloneCanvasNode(node: Node): Node {
  return structuredClone(stripEphemeralCanvasNodeState(node))
}

function cloneCanvasEdge(edge: Edge): Edge {
  // Canvas edges do not carry ephemeral renderer runtime state, so a direct clone is sufficient.
  return structuredClone(edge)
}

function getCurrentCanvasNodes(nodesMap: Y.Map<Node>): Array<Node> {
  return sortCanvasElementsByZIndex(Array.from(nodesMap.values()))
}

function getCurrentCanvasEdges(edgesMap: Y.Map<Edge>): Array<Edge> {
  return sortCanvasElementsByZIndex(Array.from(edgesMap.values()))
}

export function createCanvasClipboardEntry(
  nodesMap: Y.Map<Node>,
  edgesMap: Y.Map<Edge>,
  selection: CanvasSelectionSnapshot,
): CanvasClipboardEntry | null {
  const selectedNodes = getCurrentCanvasNodes(nodesMap).filter((node) =>
    selection.nodeIds.has(node.id),
  )
  if (selectedNodes.length === 0) {
    return null
  }

  const selectedNodeIds = new Set(selectedNodes.map((node) => node.id))
  const selectedEdges = getCurrentCanvasEdges(edgesMap).filter(
    (edge) => selectedNodeIds.has(edge.source) && selectedNodeIds.has(edge.target),
  )

  return {
    nodes: selectedNodes.map(cloneCanvasNode),
    edges: selectedEdges.map(cloneCanvasEdge),
    pasteCount: 0,
  }
}

export function materializeCanvasPaste(
  nodesMap: Y.Map<Node>,
  edgesMap: Y.Map<Edge>,
  clipboardEntry: CanvasClipboardEntry,
): MaterializedCanvasPaste {
  const nodeIdMap = new Map<string, string>()
  const offset = CANVAS_PASTE_OFFSET * (clipboardEntry.pasteCount + 1)
  const nextNodeZIndex = getNextCanvasElementZIndex(getCurrentCanvasNodes(nodesMap))
  const nextEdgeZIndex = getNextCanvasElementZIndex(getCurrentCanvasEdges(edgesMap))

  const nodes = clipboardEntry.nodes.map((node, index) => {
    const nextId = crypto.randomUUID()
    nodeIdMap.set(node.id, nextId)
    return {
      ...cloneCanvasNode(node),
      id: nextId,
      position: {
        x: node.position.x + offset,
        y: node.position.y + offset,
      },
      zIndex: nextNodeZIndex + index,
    }
  })

  const edges = clipboardEntry.edges.flatMap((edge, index) => {
    const source = nodeIdMap.get(edge.source)
    const target = nodeIdMap.get(edge.target)
    if (!source || !target) {
      return []
    }

    return [
      {
        ...cloneCanvasEdge(edge),
        id: `e-${source}-${target}-${crypto.randomUUID()}`,
        source,
        target,
        zIndex: nextEdgeZIndex + index,
      },
    ]
  })

  return {
    nodes,
    edges,
    selection: {
      nodeIds: new Set(nodes.map((node) => node.id)),
      edgeIds: new Set(edges.map((edge) => edge.id)),
    },
  }
}

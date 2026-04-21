import { stripEphemeralCanvasNodeState } from '../../utils/canvas-node-persistence'
import { sortCanvasElementsByZIndex } from '../document/canvas-z-order'
import type { Edge, Node } from '@xyflow/react'
import type * as Y from 'yjs'

export function cloneCanvasNode(node: Node): Node {
  return structuredClone(stripEphemeralCanvasNodeState(node))
}

export function cloneCanvasEdge(edge: Edge): Edge {
  return structuredClone(edge)
}

export function getCurrentCanvasNodes(nodesMap: Y.Map<Node>): Array<Node> {
  return sortCanvasElementsByZIndex(
    Array.from(nodesMap.values()).map(stripEphemeralCanvasNodeState),
  )
}

export function getCurrentCanvasEdges(edgesMap: Y.Map<Edge>): Array<Edge> {
  return sortCanvasElementsByZIndex(Array.from(edgesMap.values()))
}

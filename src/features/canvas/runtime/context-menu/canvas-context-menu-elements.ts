import { stripEphemeralCanvasNodeState } from '../../utils/canvas-node-persistence'
import { getOrderedCanvasElements } from '../document/canvas-stack-order'
import type { Edge, Node } from '@xyflow/react'
import type * as Y from 'yjs'

export function cloneCanvasNode(node: Node): Node {
  return structuredClone(stripEphemeralCanvasNodeState(node))
}

export function cloneCanvasEdge(edge: Edge): Edge {
  return structuredClone(edge)
}

export function getCurrentCanvasNodes(nodesMap: Y.Map<Node>): Array<Node> {
  return getOrderedCanvasElements(Array.from(nodesMap.values()).map(stripEphemeralCanvasNodeState))
}

export function getCurrentCanvasEdges(edgesMap: Y.Map<Edge>): Array<Edge> {
  return getOrderedCanvasElements(Array.from(edgesMap.values()))
}

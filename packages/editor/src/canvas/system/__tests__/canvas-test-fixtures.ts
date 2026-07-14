import type {
  CanvasDocumentEdge as Edge,
  CanvasDocumentNode as Node,
} from '../../document-contract'
import { testCanvasNodeId } from 'shared/test/canvas-node-id'

export function createNode(id: string, zIndex: number): Node {
  return {
    id: testCanvasNodeId(id),
    type: 'text',
    position: { x: 0, y: 0 },
    zIndex,
    data: {},
  }
}

export function createEdge(id: string, source: string, target: string): Edge {
  return {
    id,
    source: testCanvasNodeId(source),
    target: testCanvasNodeId(target),
    type: 'bezier',
  }
}

import { describe, expect, it } from 'vite-plus/test'
import { testCanvasNodeId } from 'shared/test/canvas-node-id'
import * as Y from 'yjs'
import { transactCanvasMap, transactCanvasMaps } from '../canvas-yjs-transactions'
import type {
  CanvasDocumentEdge as Edge,
  CanvasDocumentNode as Node,
} from '../../../document-contract'

describe('transactCanvasMaps', () => {
  it('rejects attached and detached maps instead of committing a partial transaction', () => {
    const doc = new Y.Doc()
    const nodesMap = doc.getMap<Node>('nodes')
    const edgesMap = new Y.Map<Edge>()

    expect(() => {
      transactCanvasMaps(nodesMap, edgesMap, () => {
        nodesMap.set('node-1', createNode('node-1'))
        edgesMap.set('edge-1', createEdge('edge-1'))
      })
    }).toThrow('transactCanvasMaps requires nodesMap.doc and edgesMap.doc to match')

    expect(nodesMap.has('node-1')).toBe(false)
    expect(edgesMap.has('edge-1')).toBe(false)
    doc.destroy()
  })

  it('commits mutations to both maps when they share a document', () => {
    const doc = new Y.Doc()
    const nodesMap = doc.getMap<Node>('nodes')
    const edgesMap = doc.getMap<Edge>('edges')

    transactCanvasMaps(nodesMap, edgesMap, () => {
      nodesMap.set('node-1', createNode('node-1'))
      edgesMap.set('edge-1', createEdge('edge-1'))
    })

    expect(nodesMap.has('node-1')).toBe(true)
    expect(edgesMap.has('edge-1')).toBe(true)
    doc.destroy()
  })

  it('commits a single-map mutation', () => {
    const doc = new Y.Doc()
    const nodesMap = doc.getMap<Node>('nodes')

    transactCanvasMap(nodesMap, () => {
      nodesMap.set('node-1', createNode('node-1'))
    })

    expect(nodesMap.has('node-1')).toBe(true)
    doc.destroy()
  })
})

function createNode(id: string): Node {
  return {
    id: testCanvasNodeId(id),
    type: 'text',
    position: { x: 0, y: 0 },
    data: {},
  }
}

function createEdge(id: string): Edge {
  return {
    id,
    type: 'bezier',
    source: testCanvasNodeId('node-1'),
    target: testCanvasNodeId('node-2'),
  }
}

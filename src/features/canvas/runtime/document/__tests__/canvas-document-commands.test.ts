import { describe, expect, it, vi } from 'vitest'
import * as Y from 'yjs'
import { applyCanvasPasteCommand, setCanvasNodePositionsCommand } from '../canvas-document-commands'
import type { CanvasSelectionSnapshot } from '../../../system/canvas-selection'
import type {
  CanvasDocumentEdge as Edge,
  CanvasDocumentNode as Node,
} from '~/features/canvas/domain/canvas-document'

function createNode(id: string): Node {
  return {
    id,
    type: 'text',
    position: { x: 10, y: 20 },
    width: 120,
    height: 40,
    data: {},
  }
}

function createEdge(id: string): Edge {
  return {
    id,
    source: 'node-1',
    target: 'node-2',
    type: 'straight',
  }
}

function createCanvasMaps() {
  const doc = new Y.Doc()
  const nodesMap = doc.getMap<Node>('nodes')
  const edgesMap = doc.getMap<Edge>('edges')

  return { doc, nodesMap, edgesMap }
}

function selectionSnapshot(
  nodeIds: ReadonlySet<string> = new Set<string>(),
  edgeIds: ReadonlySet<string> = new Set<string>(),
): CanvasSelectionSnapshot {
  return { nodeIds, edgeIds }
}

describe('canvas document commands', () => {
  it('validates pasted nodes before writing any pasted content', () => {
    const { doc, nodesMap, edgesMap } = createCanvasMaps()
    const onApplied = vi.fn()

    expect(() =>
      applyCanvasPasteCommand({
        nodesMap,
        edgesMap,
        paste: {
          nodes: [createNode('node-1'), createNode('node-2')],
          edges: [createEdge('edge-1')],
          selection: selectionSnapshot(new Set(['node-1', 'node-2']), new Set(['edge-1'])),
        },
        sanitizeNode: (node) => {
          if (node.id === 'node-2') {
            throw new Error('invalid node')
          }
          return node
        },
        onApplied,
      }),
    ).toThrow('invalid node')

    expect(Array.from(nodesMap.keys())).toEqual([])
    expect(Array.from(edgesMap.keys())).toEqual([])
    expect(onApplied).not.toHaveBeenCalled()
    doc.destroy()
  })

  it('validates multi-node position updates before writing any node updates', () => {
    const { doc, nodesMap } = createCanvasMaps()
    nodesMap.set('node-1', createNode('node-1'))
    nodesMap.set('node-2', createNode('node-2'))

    expect(() =>
      setCanvasNodePositionsCommand({
        nodesMap,
        positions: new Map([
          ['node-1', { x: 100, y: 100 }],
          ['node-2', { x: 200, y: 200 }],
        ]),
        sanitizeNode: (node) => {
          if (node.id === 'node-2') {
            throw new Error('invalid node')
          }
          return node
        },
      }),
    ).toThrow('invalid node')

    expect(nodesMap.get('node-1')?.position).toEqual({ x: 10, y: 20 })
    expect(nodesMap.get('node-2')?.position).toEqual({ x: 10, y: 20 })
    doc.destroy()
  })
})

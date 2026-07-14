import * as Y from 'yjs'
import { describe, expect, it } from 'vite-plus/test'
import { testCanvasNodeId } from 'shared/test/canvas-node-id'
import { isUuidV7 } from '../../../../resources/domain-id'
import type { CanvasDocumentEdge, CanvasDocumentNode } from '../../../document-contract'
import {
  createCanvasClipboardEntry,
  materializeCanvasPaste,
} from '../canvas-context-menu-clipboard'

describe('canvas context menu clipboard', () => {
  it('allocates fresh UUIDv7 node identities when materializing a paste', () => {
    const doc = new Y.Doc()
    const nodesMap = doc.getMap<CanvasDocumentNode>('nodes')
    const edgesMap = doc.getMap<CanvasDocumentEdge>('edges')
    const node: CanvasDocumentNode = {
      id: testCanvasNodeId('source-node'),
      type: 'text',
      position: { x: 10, y: 20 },
      data: {},
    }
    nodesMap.set(node.id, node)
    const entry = createCanvasClipboardEntry(nodesMap, edgesMap, {
      nodeIds: new Set([node.id]),
      edgeIds: new Set(),
    })

    expect(entry).not.toBeNull()
    const pasted = materializeCanvasPaste(nodesMap, edgesMap, entry!)

    expect(pasted.nodes).toHaveLength(1)
    expect(isUuidV7(pasted.nodes[0]!.id)).toBe(true)
    expect(pasted.nodes[0]!.id).not.toBe(node.id)
  })
})

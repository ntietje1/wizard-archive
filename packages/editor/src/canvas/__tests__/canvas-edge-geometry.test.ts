import { describe, expect, it } from 'vite-plus/test'
import { canvasEdgePath, findCanvasConnectionTarget } from '../canvas-edge-geometry'
import type { CanvasDocumentNode } from '../document-contract'
import { assertDomainId, DOMAIN_ID_KIND } from '../../resources/domain-id'

const NODE_A = assertDomainId(DOMAIN_ID_KIND.canvasNode, '01890f47-65f2-7cc0-8a3b-111111111111')
const NODE_B = assertDomainId(DOMAIN_ID_KIND.canvasNode, '01890f47-65f2-7cc0-8a3b-222222222222')
const NODES: ReadonlyArray<CanvasDocumentNode> = [
  { id: NODE_A, type: 'text', position: { x: 0, y: 0 }, data: {} },
  { id: NODE_B, type: 'embed', position: { x: 300, y: 0 }, data: {} },
]

describe('canvas edge geometry', () => {
  it('anchors persisted edges to their canonical node handles', () => {
    expect(
      canvasEdgePath(
        {
          id: 'edge-a-b',
          source: NODE_A,
          target: NODE_B,
          sourceHandle: 'right',
          targetHandle: 'left',
          type: 'straight',
        },
        new Map(NODES.map((node) => [node.id, node])),
      ),
    ).toBe('M 180 40 L 300 80')
  })

  it('snaps to the nearest non-source node handle within the canvas-space radius', () => {
    expect(findCanvasConnectionTarget(NODES, NODE_A, { x: 302, y: 80 }, 20)).toEqual({
      nodeId: NODE_B,
      handle: 'left',
    })
    expect(findCanvasConnectionTarget(NODES, NODE_A, { x: 250, y: 80 }, 20)).toBeNull()
  })
})

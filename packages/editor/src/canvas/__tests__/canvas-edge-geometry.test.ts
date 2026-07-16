import { describe, expect, it } from 'vite-plus/test'
import {
  canvasEdgeBounds,
  canvasEdgePath,
  createCanvasConnectionCandidateIndex,
} from '../canvas-edge-geometry'
import type { CanvasDocumentNode } from '../document-contract'
import { assertDomainId, DOMAIN_ID_KIND, generateDomainId } from '../../resources/domain-id'
import { CANVAS_WORKLOAD_LIMITS } from '../workload'

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

  it('bounds routed geometry with its complete rendered stroke extent', () => {
    expect(
      canvasEdgeBounds(
        {
          id: 'edge-a-b',
          source: NODE_A,
          target: NODE_B,
          sourceHandle: 'right',
          targetHandle: 'left',
          type: 'straight',
          style: { strokeWidth: 20 },
        },
        new Map(NODES.map((node) => [node.id, node])),
      ),
    ).toEqual({ x: 170, y: 30, width: 140, height: 60 })
  })

  it('snaps to the nearest non-source node handle within the canvas-space radius', () => {
    const index = createCanvasConnectionCandidateIndex(NODES)
    expect(index.find(NODE_A, { x: 302, y: 80 }, 20)).toEqual({
      nodeId: NODE_B,
      handle: 'left',
    })
    expect(index.find(NODE_A, { x: 250, y: 80 }, 20)).toBeNull()
  })

  it('finds a late target across the maximum supported node set', () => {
    const nodes = Array.from({ length: CANVAS_WORKLOAD_LIMITS.nodes }, (_, index) => ({
      id: generateDomainId(DOMAIN_ID_KIND.canvasNode),
      type: 'text' as const,
      position: { x: index * 200, y: 0 },
      data: {},
    }))
    const target = nodes.at(-1)!
    expect(
      createCanvasConnectionCandidateIndex(nodes).find(
        nodes[0]!.id,
        { x: target.position.x, y: 40 },
        20,
      ),
    ).toEqual({ nodeId: target.id, handle: 'left' })
  })
})

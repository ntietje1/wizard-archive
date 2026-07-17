import { describe, expect, it } from 'vite-plus/test'
import {
  canvasEdgeBounds,
  canvasEdgePath,
  canvasEdgePolyline,
  createCanvasConnectionCandidateIndex,
} from '../canvas-edge-geometry'
import type { CanvasDocumentNode } from '../document-contract'
import { assertDomainId, DOMAIN_ID_KIND, generateDomainId } from '../../resources/domain-id'
import { CANVAS_WORKLOAD_LIMITS } from '../workload'

const NODE_A = assertDomainId(DOMAIN_ID_KIND.canvasNode, '01890f47-65f2-7cc0-8a3b-111111111111')
const NODE_B = assertDomainId(DOMAIN_ID_KIND.canvasNode, '01890f47-65f2-7cc0-8a3b-222222222222')
const NODES: ReadonlyArray<CanvasDocumentNode> = [
  {
    id: NODE_A,
    type: 'text',
    position: { x: 0, y: 0 },
    width: 180,
    height: 80,
    data: {},
  },
  {
    id: NODE_B,
    type: 'embed',
    position: { x: 300, y: 0 },
    width: 240,
    height: 160,
    data: {},
  },
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

  it('infers facing handles for persisted edges without explicit handles', () => {
    const source = canvasNode(NODE_A, 0, 0)
    const horizontalTarget = canvasNode(NODE_B, 300, 100)
    const verticalTarget = canvasNode(NODE_B, 100, 300)

    expect(
      canvasEdgePath(
        { id: 'horizontal', source: NODE_A, target: NODE_B, type: 'straight' },
        new Map([
          [source.id, source],
          [horizontalTarget.id, horizontalTarget],
        ]),
      ),
    ).toBe('M 100 50 L 300 150')
    expect(
      canvasEdgePath(
        { id: 'vertical', source: NODE_A, target: NODE_B, type: 'straight' },
        new Map([
          [source.id, source],
          [verticalTarget.id, verticalTarget],
        ]),
      ),
    ).toBe('M 50 100 L 150 300')
  })

  it('uses directional distance for Bezier control points', () => {
    const nodes: ReadonlyArray<CanvasDocumentNode> = [
      canvasNode(NODE_A, 0, 0),
      canvasNode(NODE_B, 300, 100),
    ]

    expect(
      canvasEdgePath(
        {
          id: 'bezier',
          source: NODE_A,
          target: NODE_B,
          sourceHandle: 'right',
          targetHandle: 'left',
          type: 'bezier',
        },
        new Map(nodes.map((node) => [node.id, node])),
      ),
    ).toBe('M 100 50 C 200 50, 200 150, 300 150')
  })

  it('curves away-facing Bezier handles outward', () => {
    const source = canvasNode(NODE_A, 0, 0)
    const target = canvasNode(NODE_B, 50, 0)
    const path = canvasEdgePath(
      {
        id: 'away-facing',
        source: NODE_A,
        target: NODE_B,
        sourceHandle: 'right',
        targetHandle: 'left',
        type: 'bezier',
      },
      new Map([
        [source.id, source],
        [target.id, target],
      ]),
    )
    const controls = path?.match(/^M \S+ \S+ C (\S+) \S+, (\S+) \S+,/)

    expect(Number(controls?.[1])).toBeGreaterThan(100)
    expect(Number(controls?.[2])).toBeLessThan(50)
  })

  it('samples long Bezier edges more densely for geometric selection', () => {
    const source = canvasNode(NODE_A, 0, 0)
    const edge = {
      id: 'sampled',
      source: NODE_A,
      target: NODE_B,
      sourceHandle: 'right',
      targetHandle: 'left',
      type: 'bezier' as const,
    }
    const short = canvasEdgePolyline(
      edge,
      new Map([
        [source.id, source],
        [NODE_B, canvasNode(NODE_B, 300, 0)],
      ]),
    )
    const long = canvasEdgePolyline(
      edge,
      new Map([
        [source.id, source],
        [NODE_B, canvasNode(NODE_B, 5_000, 0)],
      ]),
    )

    expect(long?.length).toBeGreaterThan(short?.length ?? 0)
    expect(longestSegment(long ?? [])).toBeLessThanOrEqual(80)
  })

  it('routes facing and mixed step handles through reference-length stubs', () => {
    const source = canvasNode(NODE_A, 0, 0)
    const facingTarget = canvasNode(NODE_B, 220, 80)
    const mixedTarget = canvasNode(NODE_B, 160, 160)

    expect(
      canvasEdgePolyline(
        {
          id: 'facing-step',
          source: NODE_A,
          target: NODE_B,
          sourceHandle: 'right',
          targetHandle: 'left',
          type: 'step',
        },
        new Map([
          [source.id, source],
          [facingTarget.id, facingTarget],
        ]),
      ),
    ).toEqual([
      { x: 100, y: 50 },
      { x: 148, y: 50 },
      { x: 160, y: 50 },
      { x: 160, y: 130 },
      { x: 172, y: 130 },
      { x: 220, y: 130 },
    ])
    expect(
      canvasEdgePolyline(
        {
          id: 'mixed-step',
          source: NODE_A,
          target: NODE_B,
          sourceHandle: 'right',
          targetHandle: 'top',
          type: 'step',
        },
        new Map([
          [source.id, source],
          [mixedTarget.id, mixedTarget],
        ]),
      ),
    ).toEqual([
      { x: 100, y: 50 },
      { x: 148, y: 50 },
      { x: 148, y: 112 },
      { x: 210, y: 112 },
      { x: 210, y: 160 },
    ])
  })

  it('relaxes step stubs when the closest split would cross an endpoint node', () => {
    const source = { ...canvasNode(NODE_A, 0, 0), width: 200 }
    const target = canvasNode(NODE_B, 180, 0)

    expect(
      canvasEdgePolyline(
        {
          id: 'overlapping-step',
          source: NODE_A,
          target: NODE_B,
          sourceHandle: 'bottom',
          targetHandle: 'top',
          type: 'step',
        },
        new Map([
          [source.id, source],
          [target.id, target],
        ]),
      ),
    ).toEqual([
      { x: 100, y: 100 },
      { x: 100, y: 50 },
      { x: 230, y: 50 },
      { x: 230, y: 0 },
    ])
  })

  it('anchors legacy stroke handles to centerline endpoints and tangent directions', () => {
    const stroke = {
      id: NODE_A,
      type: 'stroke' as const,
      position: { x: 10, y: 20 },
      data: {
        bounds: { x: 0, y: 0, width: 100, height: 20 },
        color: 'var(--foreground)',
        opacity: 1,
        points: [
          [0, 10, 0.5],
          [100, 10, 0.5],
        ] as Array<[number, number, number]>,
        size: 4,
      },
    }
    const target = canvasNode(NODE_B, 200, 0)
    const nodes = new Map<CanvasDocumentNode['id'], CanvasDocumentNode>([
      [stroke.id, stroke],
      [target.id, target],
    ])

    expect(
      canvasEdgePath(
        {
          id: 'stroke-start',
          source: NODE_A,
          target: NODE_B,
          sourceHandle: 'start',
          targetHandle: 'left',
          type: 'straight',
        },
        nodes,
      ),
    ).toBe('M 10 30 L 200 50')
    expect(
      canvasEdgePath(
        {
          id: 'stroke-end',
          source: NODE_A,
          target: NODE_B,
          sourceHandle: 'end',
          targetHandle: 'left',
          type: 'straight',
        },
        nodes,
      ),
    ).toBe('M 110 30 L 200 50')
    expect(
      canvasEdgePath(
        {
          id: 'stroke-tangent',
          source: NODE_A,
          target: NODE_B,
          sourceHandle: 'start',
          targetHandle: 'left',
          type: 'bezier',
        },
        nodes,
      ),
    ).toMatch(/^M 10 30 C -/)
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
      width: 180,
      height: 80,
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

function longestSegment(points: ReadonlyArray<{ x: number; y: number }>): number {
  let longest = 0
  for (let index = 0; index < points.length - 1; index += 1) {
    longest = Math.max(
      longest,
      Math.hypot(points[index + 1].x - points[index].x, points[index + 1].y - points[index].y),
    )
  }
  return longest
}

function canvasNode(id: CanvasDocumentNode['id'], x: number, y: number): CanvasDocumentNode {
  return {
    id,
    type: 'text',
    position: { x, y },
    width: 100,
    height: 100,
    data: {},
  }
}

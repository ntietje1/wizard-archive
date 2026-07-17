import { describe, expect, it } from 'vite-plus/test'
import type { CanvasDocumentNode } from '../document-contract'
import {
  canvasStrokeBounds,
  canvasStrokeDocumentPoints,
  canvasStrokePath,
  createCanvasEraserCandidateIndex,
} from '../canvas-stroke-geometry'
import { assertDomainId, DOMAIN_ID_KIND, generateDomainId } from '../../resources/domain-id'
import { CANVAS_WORKLOAD_LIMITS } from '../workload'

const HIT = assertDomainId(DOMAIN_ID_KIND.canvasNode, '01890f47-65f2-7cc0-8a3b-111111111111')
const MISS = assertDomainId(DOMAIN_ID_KIND.canvasNode, '01890f47-65f2-7cc0-8a3b-222222222222')

function stroke(id: typeof HIT, y: number): CanvasDocumentNode {
  return {
    id,
    type: 'stroke',
    position: { x: 10, y },
    width: 90,
    height: 4,
    data: {
      points: [
        [10, y, 0.5],
        [100, y, 0.5],
      ],
      color: '#000000',
      size: 4,
      bounds: { x: 10, y, width: 90, height: 4 },
    },
  }
}

describe('canvas stroke eraser geometry', () => {
  it('builds pressure-aware outline geometry for rendering and bounds', () => {
    const points = [
      [0, 0, 0.2],
      [20, 10, 0.8],
      [40, 0, 0.4],
    ] as const
    const bounds = canvasStrokeBounds(points, 8)

    expect(canvasStrokePath(points, 8)).toMatch(/^M .+ Q .+ Z$/)
    expect(bounds.x).toBeLessThanOrEqual(0)
    expect(bounds.y).toBeLessThan(0)
    expect(bounds.width).toBeGreaterThan(25)
    expect(bounds.height).toBeGreaterThan(10)
  })

  it('marks only visible strokes intersected by the bounded erase trail', () => {
    const nodes: Array<CanvasDocumentNode> = [
      stroke(HIT, 10),
      stroke(MISS, 120),
      {
        id: assertDomainId(DOMAIN_ID_KIND.canvasNode, '01890f47-65f2-7cc0-8a3b-333333333333'),
        type: 'text',
        position: { x: 0, y: 0 },
        data: {},
      },
    ]
    const index = createCanvasEraserCandidateIndex(nodes)

    expect(
      index.erase(
        [
          { x: 40, y: 0 },
          { x: 40, y: 40 },
        ],
        new Set(),
      ),
    ).toEqual(new Set([HIT]))
    expect(
      index.erase(
        [
          { x: 40, y: 100 },
          { x: 40, y: 140 },
        ],
        new Set([HIT]),
      ),
    ).toEqual(new Set([HIT, MISS]))
  })

  it('scales authored stroke points with resized document bounds', () => {
    const resized = { ...stroke(HIT, 10), width: 180, height: 8 }
    expect(resized.type).toBe('stroke')
    if (resized.type !== 'stroke') throw new Error('Expected stroke node')
    expect(canvasStrokeDocumentPoints(resized)).toEqual([
      { x: 10, y: 10 },
      { x: 190, y: 10 },
    ])
  })

  it('erases across the maximum supported stroke set without refusing late candidates', () => {
    const nodes = Array.from({ length: CANVAS_WORKLOAD_LIMITS.nodes }, (_, index) => ({
      ...stroke(generateDomainId(DOMAIN_ID_KIND.canvasNode), 10),
      position: { x: index * 80, y: 10 },
    }))
    const trail = Array.from({ length: CANVAS_WORKLOAD_LIMITS.gesturePoints }, (_, index) => ({
      x: index * 80 + 40,
      y: index % 2 === 0 ? 0 : 20,
    }))
    const startedAt = performance.now()
    const result = createCanvasEraserCandidateIndex(nodes).erase(trail, new Set())
    expect(result).toEqual(new Set(nodes.map((node) => node.id)))
    expect(performance.now() - startedAt).toBeLessThan(1_000)
  })
})

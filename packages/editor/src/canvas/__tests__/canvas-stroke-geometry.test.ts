import { describe, expect, it } from 'vite-plus/test'
import type { CanvasDocumentNode } from '../document-contract'
import {
  canvasStrokeLocalPoints,
  findCanvasStrokesIntersectingTrail,
} from '../canvas-stroke-geometry'
import { assertDomainId, DOMAIN_ID_KIND } from '../../resources/domain-id'

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

    expect(
      findCanvasStrokesIntersectingTrail(nodes, [
        { x: 40, y: 0 },
        { x: 40, y: 40 },
      ]),
    ).toEqual(new Set([HIT]))
    expect(
      findCanvasStrokesIntersectingTrail(
        nodes,
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
    expect(canvasStrokeLocalPoints(resized)).toEqual([
      { x: 0, y: 0 },
      { x: 180, y: 0 },
    ])
  })
})

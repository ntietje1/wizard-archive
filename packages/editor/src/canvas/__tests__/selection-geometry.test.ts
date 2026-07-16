import { describe, expect, it } from 'vite-plus/test'
import type { CanvasDocumentContent } from '../document-contract'
import {
  canvasBoundsFromPoints,
  selectCanvasContentInPolygon,
  selectCanvasContentInRectangle,
} from '../selection-geometry'
import { assertDomainId, DOMAIN_ID_KIND } from '../../resources/domain-id'

const NODE_A = assertDomainId(DOMAIN_ID_KIND.canvasNode, '01890f47-65f2-7cc0-8a3b-111111111111')
const NODE_B = assertDomainId(DOMAIN_ID_KIND.canvasNode, '01890f47-65f2-7cc0-8a3b-222222222222')
const STROKE = assertDomainId(DOMAIN_ID_KIND.canvasNode, '01890f47-65f2-7cc0-8a3b-333333333333')

const CONTENT: CanvasDocumentContent = {
  nodes: [
    {
      id: NODE_A,
      type: 'text',
      position: { x: 10, y: 10 },
      width: 80,
      height: 80,
      data: {},
    },
    {
      id: NODE_B,
      type: 'embed',
      position: { x: 210, y: 10 },
      width: 80,
      height: 80,
      data: {},
    },
    {
      id: STROKE,
      type: 'stroke',
      position: { x: 400, y: 100 },
      width: 100,
      height: 20,
      data: {
        bounds: { x: 120, y: 40, width: 100, height: 20 },
        points: [
          [120, 50, 0.5],
          [220, 50, 0.5],
        ],
        color: '#000000',
        size: 4,
      },
    },
  ],
  edges: [{ id: 'edge-a-b', source: NODE_A, target: NODE_B, type: 'straight' }],
}

describe('canvas selection geometry', () => {
  it('normalizes drag direction and selects partially overlapping surface nodes', () => {
    const bounds = canvasBoundsFromPoints({ x: 30, y: 30 }, { x: 0, y: 0 })
    expect(bounds).toEqual({ x: 0, y: 0, width: 30, height: 30 })
    expect(selectCanvasContentInRectangle(CONTENT, bounds, 1)).toEqual({
      nodeIds: new Set([NODE_A]),
      edgeIds: new Set(),
    })
  })

  it('selects edge paths independently of their endpoint nodes', () => {
    expect(
      selectCanvasContentInRectangle(CONTENT, { x: 110, y: 45, width: 80, height: 10 }, 1),
    ).toEqual({ nodeIds: new Set(), edgeIds: new Set(['edge-a-b']) })
  })

  it('uses screen-space padding and rendered offsets for stroke selection', () => {
    expect(
      selectCanvasContentInRectangle(CONTENT, { x: 440, y: 120, width: 20, height: 1 }, 1).nodeIds,
    ).toEqual(new Set([STROKE]))
    expect(
      selectCanvasContentInRectangle(CONTENT, { x: 440, y: 120, width: 20, height: 1 }, 4).nodeIds,
    ).toEqual(new Set())
  })

  it('selects mixed node-edge content intersecting a lasso polygon', () => {
    expect(
      selectCanvasContentInPolygon(CONTENT, [
        { x: 190, y: 0 },
        { x: 300, y: 0 },
        { x: 300, y: 100 },
        { x: 190, y: 100 },
      ]),
    ).toEqual({ nodeIds: new Set([NODE_B]), edgeIds: new Set(['edge-a-b']) })
  })

  it('ignores short lasso trails and hidden content', () => {
    expect(
      selectCanvasContentInPolygon(CONTENT, [
        { x: 0, y: 0 },
        { x: 10, y: 10 },
      ]),
    ).toEqual({
      nodeIds: new Set(),
      edgeIds: new Set(),
    })
    const hidden: CanvasDocumentContent = {
      nodes: CONTENT.nodes.map((node) => ({ ...node, hidden: true })),
      edges: CONTENT.edges.map((edge) => ({ ...edge, hidden: true })),
    }
    expect(
      selectCanvasContentInRectangle(hidden, { x: 0, y: 0, width: 600, height: 300 }, 1),
    ).toEqual({ nodeIds: new Set(), edgeIds: new Set() })
  })
})

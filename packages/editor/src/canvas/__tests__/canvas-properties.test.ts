import { describe, expect, it } from 'vite-plus/test'
import { createCanvasPropertyChange, resolveCanvasSharedValue } from '../canvas-properties'
import type { CanvasDocumentContent } from '../document-contract'
import { assertDomainId, DOMAIN_ID_KIND } from '../../resources/domain-id'

const NODE_A = assertDomainId(DOMAIN_ID_KIND.canvasNode, '01890f47-65f2-7cc0-8a3b-111111111111')
const NODE_B = assertDomainId(DOMAIN_ID_KIND.canvasNode, '01890f47-65f2-7cc0-8a3b-222222222222')
const STROKE = assertDomainId(DOMAIN_ID_KIND.canvasNode, '01890f47-65f2-7cc0-8a3b-333333333333')

const CONTENT: CanvasDocumentContent = {
  nodes: [
    {
      id: NODE_A,
      type: 'text',
      position: { x: 0, y: 0 },
      data: { borderWidth: 3 },
    },
    {
      id: NODE_B,
      type: 'embed',
      position: { x: 200, y: 0 },
      data: { borderWidth: 7 },
    },
    {
      id: STROKE,
      type: 'stroke',
      position: { x: 0, y: 100 },
      data: {
        points: [
          [0, 100, 0.5],
          [100, 100, 0.5],
        ],
        color: '#000000',
        size: 4,
        opacity: 50,
        bounds: { x: 0, y: 100, width: 100, height: 1 },
      },
    },
  ],
  edges: [
    {
      id: 'edge-a-b',
      source: NODE_A,
      target: NODE_B,
      type: 'straight',
      style: { stroke: '#000000', strokeWidth: 4, opacity: 0.5 },
    },
  ],
}

describe('canvas properties', () => {
  it('represents unavailable, shared, and mixed selection values explicitly', () => {
    expect(resolveCanvasSharedValue([])).toEqual({ state: 'unavailable' })
    expect(resolveCanvasSharedValue([3, 3])).toEqual({ state: 'shared', value: 3 })
    expect(resolveCanvasSharedValue([3, 7])).toEqual({ state: 'mixed' })
  })

  it('fans a surface update across selected surface nodes as field intent', () => {
    expect(
      createCanvasPropertyChange(
        CONTENT,
        { nodeIds: new Set([NODE_A, NODE_B, STROKE]), edgeIds: new Set() },
        { property: 'borderWidth', value: 5 },
      ),
    ).toEqual({
      type: 'update',
      nodes: [
        { id: NODE_A, type: 'text', data: { borderWidth: 5 } },
        { id: NODE_B, type: 'embed', data: { borderWidth: 5 } },
      ],
      edges: [],
    })
    expect(
      createCanvasPropertyChange(
        CONTENT,
        { nodeIds: new Set([NODE_A, NODE_B]), edgeIds: new Set() },
        { property: 'border', value: { color: 'var(--t-red)', opacity: 40 } },
      ),
    ).toEqual({
      type: 'update',
      nodes: [
        {
          id: NODE_A,
          type: 'text',
          data: { borderStroke: 'var(--t-red)', borderOpacity: 40 },
        },
        {
          id: NODE_B,
          type: 'embed',
          data: { borderStroke: 'var(--t-red)', borderOpacity: 40 },
        },
      ],
      edges: [],
    })
  })

  it('fans line properties across strokes and edges with their canonical units', () => {
    const selection = { nodeIds: new Set([STROKE]), edgeIds: new Set(['edge-a-b']) }
    expect(
      createCanvasPropertyChange(CONTENT, selection, { property: 'lineWidth', value: 7 }),
    ).toEqual({
      type: 'update',
      nodes: [{ id: STROKE, type: 'stroke', data: { size: 7 } }],
      edges: [{ id: 'edge-a-b', style: { strokeWidth: 7 } }],
    })
    expect(
      createCanvasPropertyChange(CONTENT, selection, {
        property: 'linePaint',
        value: { color: 'var(--t-blue)', opacity: 80 },
      }),
    ).toEqual({
      type: 'update',
      nodes: [
        {
          id: STROKE,
          type: 'stroke',
          data: { color: 'var(--t-blue)', opacity: 80 },
        },
      ],
      edges: [{ id: 'edge-a-b', style: { stroke: 'var(--t-blue)', opacity: 0.8 } }],
    })
  })

  it('changes edge type and omits effective no-ops', () => {
    const selection = { nodeIds: new Set<typeof NODE_A>(), edgeIds: new Set(['edge-a-b']) }
    expect(
      createCanvasPropertyChange(CONTENT, selection, { property: 'edgeType', value: 'step' }),
    ).toEqual({
      type: 'update',
      nodes: [],
      edges: [{ id: 'edge-a-b', type: 'step' }],
    })
    expect(
      createCanvasPropertyChange(CONTENT, selection, { property: 'edgeType', value: 'straight' }),
    ).toBeNull()
    expect(
      createCanvasPropertyChange(
        {
          nodes: [{ id: NODE_A, type: 'text', position: { x: 0, y: 0 }, data: {} }],
          edges: [],
        },
        { nodeIds: new Set([NODE_A]), edgeIds: new Set() },
        {
          property: 'fill',
          value: { color: 'var(--background)', opacity: 100 },
        },
      ),
    ).toBeNull()
  })
})

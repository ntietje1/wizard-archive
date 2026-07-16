import { describe, expect, it } from 'vite-plus/test'
import { createCanvasReorderChange } from '../canvas-z-order'
import type { CanvasDocumentContent } from '../document-contract'
import { assertDomainId, DOMAIN_ID_KIND } from '../../resources/domain-id'

const NODE_A = assertDomainId(DOMAIN_ID_KIND.canvasNode, '01890f47-65f2-7cc0-8a3b-111111111111')
const NODE_B = assertDomainId(DOMAIN_ID_KIND.canvasNode, '01890f47-65f2-7cc0-8a3b-222222222222')

const CONTENT: CanvasDocumentContent = {
  nodes: [
    { id: NODE_A, type: 'text', position: { x: 0, y: 0 }, zIndex: 1, data: {} },
    { id: NODE_B, type: 'text', position: { x: 0, y: 0 }, zIndex: 3, data: {} },
  ],
  edges: [
    { id: 'edge-a', source: NODE_A, target: NODE_B, type: 'straight', zIndex: 2 },
    { id: 'edge-b', source: NODE_A, target: NODE_B, type: 'straight', zIndex: 4 },
  ],
}

describe('canvas z-order', () => {
  it('normalizes tied indices in stable mixed document order', () => {
    const tied = {
      nodes: CONTENT.nodes.map((node) => ({ ...node, zIndex: 4 })),
      edges: CONTENT.edges.map((edge) => ({ ...edge, zIndex: 4 })),
    }
    expect(
      createCanvasReorderChange(
        tied,
        { nodeIds: new Set([NODE_A]), edgeIds: new Set() },
        'sendToBack',
      ),
    ).toEqual({
      type: 'replace',
      nodes: [
        { ...tied.nodes[0], zIndex: 1 },
        { ...tied.nodes[1], zIndex: 2 },
      ],
      edges: [{ ...tied.edges[0], zIndex: 3 }],
    })
  })

  it('reorders mixed node-edge layers in one normalized replacement', () => {
    expect(
      createCanvasReorderChange(
        CONTENT,
        { nodeIds: new Set(), edgeIds: new Set(['edge-a']) },
        'bringToFront',
      ),
    ).toEqual({
      type: 'replace',
      nodes: [{ ...CONTENT.nodes[1], zIndex: 2 }],
      edges: [
        { ...CONTENT.edges[1], zIndex: 3 },
        { ...CONTENT.edges[0], zIndex: 4 },
      ],
    })
  })

  it('moves grouped selections one layer without crossing selected neighbors', () => {
    expect(
      createCanvasReorderChange(
        CONTENT,
        { nodeIds: new Set([NODE_A, NODE_B]), edgeIds: new Set() },
        'bringForward',
      ),
    ).toEqual({
      type: 'replace',
      nodes: [
        { ...CONTENT.nodes[0], zIndex: 2 },
        { ...CONTENT.nodes[1], zIndex: 4 },
      ],
      edges: [
        { ...CONTENT.edges[0], zIndex: 1 },
        { ...CONTENT.edges[1], zIndex: 3 },
      ],
    })
  })

  it('returns no change for empty, missing, and already ordered selections', () => {
    expect(
      createCanvasReorderChange(
        CONTENT,
        { nodeIds: new Set(), edgeIds: new Set() },
        'bringToFront',
      ),
    ).toBeNull()
    expect(
      createCanvasReorderChange(
        CONTENT,
        { nodeIds: new Set(), edgeIds: new Set(['missing']) },
        'sendToBack',
      ),
    ).toBeNull()
    expect(
      createCanvasReorderChange(
        CONTENT,
        { nodeIds: new Set(), edgeIds: new Set(['edge-b']) },
        'bringToFront',
      ),
    ).toBeNull()
  })
})

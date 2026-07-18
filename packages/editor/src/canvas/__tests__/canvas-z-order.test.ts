import { describe, expect, it } from 'vite-plus/test'
import { createCanvasReorderChange } from '../canvas-z-order'
import type { CanvasDocumentContent } from '../document-contract'
import { assertDomainId, DOMAIN_ID_KIND, generateDomainId } from '../../resources/domain-id'
import { CANVAS_WORKLOAD_LIMITS } from '../workload'

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
  it('moves tied elements without rewriting unrelated order fields', () => {
    const tied = {
      nodes: CONTENT.nodes.map((node) => ({ ...node, zIndex: 4 })),
      edges: CONTENT.edges.map((edge) => ({ ...edge, zIndex: 4 })),
    }
    expect(
      createCanvasReorderChange(
        tied,
        { nodeIds: new Set([NODE_B]), edgeIds: new Set() },
        'sendToBack',
      ),
    ).toEqual({
      type: 'update',
      nodes: [{ id: NODE_B, type: 'text', zIndex: -1 }],
      edges: [],
    })
  })

  it('reorders edges within the edge plane', () => {
    expect(
      createCanvasReorderChange(
        CONTENT,
        { nodeIds: new Set(), edgeIds: new Set(['edge-a']) },
        'bringToFront',
      ),
    ).toEqual({
      type: 'update',
      nodes: [],
      edges: [{ id: 'edge-a', zIndex: 5 }],
    })
  })

  it('reorders mixed selections independently within the node and edge planes', () => {
    expect(
      createCanvasReorderChange(
        CONTENT,
        { nodeIds: new Set([NODE_A]), edgeIds: new Set(['edge-a']) },
        'bringForward',
      ),
    ).toEqual({
      type: 'update',
      nodes: [
        { id: NODE_A, type: 'text', zIndex: 3 },
        { id: NODE_B, type: 'text', zIndex: 1 },
      ],
      edges: [
        { id: 'edge-a', zIndex: 4 },
        { id: 'edge-b', zIndex: 2 },
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

  it('bounds adversarial layer changes to the selected records', () => {
    const nodes = Array.from({ length: CANVAS_WORKLOAD_LIMITS.nodes }, (_, zIndex) => ({
      id: generateDomainId(DOMAIN_ID_KIND.canvasNode),
      type: 'text' as const,
      position: { x: 0, y: 0 },
      data: {},
      zIndex,
    }))
    const selected = new Set(
      nodes.slice(0, CANVAS_WORKLOAD_LIMITS.selectedElements).map((node) => node.id),
    )

    const change = createCanvasReorderChange(
      { nodes, edges: [] },
      { nodeIds: selected, edgeIds: new Set() },
      'bringToFront',
    )

    expect(change?.type).toBe('update')
    if (change?.type !== 'update') throw new Error('Expected bounded layer update')
    expect(change.nodes).toHaveLength(CANVAS_WORKLOAD_LIMITS.selectedElements)
    expect(change.nodes.every((node) => selected.has(node.id))).toBe(true)
    expect(change.edges).toEqual([])
    expect(nodes.at(-1)?.zIndex).toBe(CANVAS_WORKLOAD_LIMITS.nodes - 1)
  })
})

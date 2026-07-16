import { describe, expect, it } from 'vite-plus/test'
import { captureCanvasSelection, materializeCanvasPaste } from '../canvas-clipboard'
import type { CanvasDocumentContent } from '../document-contract'
import { DOMAIN_ID_KIND, assertDomainId, isUuidV7 } from '../../resources/domain-id'
import { CANVAS_WORKLOAD_LIMITS } from '../workload'

const NODE_A = assertDomainId(DOMAIN_ID_KIND.canvasNode, '01890f47-65f2-7cc0-8a3b-111111111111')
const NODE_B = assertDomainId(DOMAIN_ID_KIND.canvasNode, '01890f47-65f2-7cc0-8a3b-222222222222')
const NODE_C = assertDomainId(DOMAIN_ID_KIND.canvasNode, '01890f47-65f2-7cc0-8a3b-333333333333')

const content: CanvasDocumentContent = {
  nodes: [
    { id: NODE_A, type: 'text', position: { x: 10, y: 20 }, data: {}, zIndex: 2 },
    { id: NODE_B, type: 'embed', position: { x: 100, y: 200 }, data: {}, zIndex: 4 },
    { id: NODE_C, type: 'text', position: { x: 300, y: 400 }, data: {}, zIndex: 6 },
  ],
  edges: [
    { id: 'edge-a-b', source: NODE_A, target: NODE_B, type: 'step', zIndex: 3 },
    { id: 'edge-b-c', source: NODE_B, target: NODE_C, type: 'straight', zIndex: 5 },
  ],
}

describe('canvas clipboard', () => {
  it('copies a node closure and remaps pasted topology, positions, layers, and identities', () => {
    const clipboard = captureCanvasSelection(content, {
      nodeIds: new Set([NODE_A, NODE_B]),
      edgeIds: new Set(['edge-a-b', 'edge-b-c']),
    })
    expect(clipboard).not.toBeNull()
    if (!clipboard) throw new Error('Expected canvas clipboard entry')
    expect(clipboard.nodes.map((node) => node.id)).toEqual([NODE_A, NODE_B])
    expect(clipboard.edges.map((edge) => edge.id)).toEqual(['edge-a-b'])

    const first = materializeCanvasPaste(content, clipboard)
    expect(first).not.toBeNull()
    if (!first) throw new Error('Expected materialized paste')
    expect(first.change.nodes.map((node) => node.position)).toEqual([
      { x: 42, y: 52 },
      { x: 132, y: 232 },
    ])
    expect(first.change.nodes.every((node) => isUuidV7(node.id))).toBe(true)
    expect(first.change.nodes.map((node) => node.id)).not.toEqual([NODE_A, NODE_B])
    expect(first.change.edges).toHaveLength(1)
    expect(first.change.edges[0]).toMatchObject({
      source: first.change.nodes[0]!.id,
      target: first.change.nodes[1]!.id,
      type: 'step',
    })
    expect(isUuidV7(first.change.edges[0]!.id)).toBe(true)
    expect(first.selection).toEqual({
      nodeIds: new Set(first.change.nodes.map((node) => node.id)),
      edgeIds: new Set(first.change.edges.map((edge) => edge.id)),
    })
    expect(first.change.nodes.map((node) => node.zIndex)).toEqual([7, 9])
    expect(first.change.edges.map((edge) => edge.zIndex)).toEqual([8])

    const nextContent = {
      nodes: [...content.nodes, ...first.change.nodes],
      edges: [...content.edges, ...first.change.edges],
    }
    const second = materializeCanvasPaste(nextContent, first.nextClipboard)
    expect(second?.change.nodes.map((node) => node.position)).toEqual([
      { x: 74, y: 84 },
      { x: 164, y: 264 },
    ])
  })

  it('does not create an edge-only clipboard entry', () => {
    expect(
      captureCanvasSelection(content, {
        nodeIds: new Set(),
        edgeIds: new Set(['edge-a-b']),
      }),
    ).toBeNull()
  })

  it('rejects a paste that would exceed the canonical canvas workload', () => {
    const clipboard = captureCanvasSelection(content, {
      nodeIds: new Set([NODE_A]),
      edgeIds: new Set(),
    })
    expect(clipboard).not.toBeNull()
    if (!clipboard) throw new Error('Expected canvas clipboard entry')
    expect(
      materializeCanvasPaste(
        {
          nodes: Array.from({ length: CANVAS_WORKLOAD_LIMITS.nodes }, () => content.nodes[0]!),
          edges: [],
        },
        clipboard,
      ),
    ).toBeNull()
  })
})

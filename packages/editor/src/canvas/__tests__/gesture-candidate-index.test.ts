import { describe, expect, it } from 'vite-plus/test'
import { generateDomainId, DOMAIN_ID_KIND } from '../../resources/domain-id'
import { createCanvasConnectionCandidateIndex } from '../canvas-edge-geometry'
import { createCanvasEraserCandidateIndex } from '../canvas-stroke-geometry'
import { createCanvasSnapTargetIndex } from '../canvas-snap-geometry'
import { createCanvasSelectionCandidateIndex } from '../selection-geometry'
import type { CanvasDocumentNode } from '../document-contract'
import { CANVAS_WORKLOAD_LIMITS } from '../workload'

describe('canvas gesture candidate indexes', () => {
  it('queries relevant geometry without rescanning maximum-size candidate corpora', () => {
    const startedAt = performance.now()
    const nodes = Array.from({ length: CANVAS_WORKLOAD_LIMITS.nodes }, (_, index) => ({
      id: generateDomainId(DOMAIN_ID_KIND.canvasNode),
      type: 'text' as const,
      position: { x: index * 1_000, y: 0 },
      width: 180,
      height: 80,
      data: {},
    }))
    const target = nodes[nodes.length - 1]!
    const targetBounds = { ...target.position, width: 180, height: 80 }

    const snap = createCanvasSnapTargetIndex(nodes, new Set())
    const snapQuery = snap.near(targetBounds, 8)
    expect(snapQuery).toContainEqual(targetBounds)

    const connection = createCanvasConnectionCandidateIndex(nodes).find(
      nodes[0]!.id,
      { x: target.position.x, y: 40 },
      20,
    )
    expect(connection).toEqual({ nodeId: target.id, handle: 'left' })

    const selection = createCanvasSelectionCandidateIndex({ nodes, edges: [] }).rectangle(
      targetBounds,
      1,
    )
    expect(selection.nodeIds).toEqual(new Set([target.id]))

    const strokes = nodes.map((node) => strokeNode(node.id, node.position.x))
    const eraser = createCanvasEraserCandidateIndex(strokes).erase(
      [
        { x: target.position.x + 50, y: -10 },
        { x: target.position.x + 50, y: 30 },
      ],
      new Set(),
    )
    expect(eraser).toEqual(new Set([target.id]))
    expect(performance.now() - startedAt).toBeLessThan(1_000)
  })
})

function strokeNode(
  id: CanvasDocumentNode['id'],
  x: number,
): Extract<CanvasDocumentNode, { type: 'stroke' }> {
  return {
    id,
    type: 'stroke',
    position: { x, y: 0 },
    width: 100,
    height: 20,
    data: {
      bounds: { x: 0, y: 0, width: 100, height: 20 },
      points: [
        [0, 10, 0.5],
        [100, 10, 0.5],
      ],
      color: '#000000',
      size: 4,
    },
  }
}

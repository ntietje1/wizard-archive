import { describe, expect, it } from 'vite-plus/test'
import { canvasEdgePath, createCanvasConnectionCandidateIndex } from '../canvas-edge-geometry'
import type { CanvasDocumentNode } from '../document-contract'
import { assertDomainId, DOMAIN_ID_KIND } from '../../resources/domain-id'
import { CANVAS_WORKLOAD_LIMITS, createCanvasCandidateWorkBudget } from '../workload'

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

  it('snaps to the nearest non-source node handle within the canvas-space radius', () => {
    const index = createCanvasConnectionCandidateIndex(NODES)
    expect(
      index.find(NODE_A, { x: 302, y: 80 }, 20, createCanvasCandidateWorkBudget()).target,
    ).toEqual({ nodeId: NODE_B, handle: 'left' })
    expect(
      index.find(NODE_A, { x: 250, y: 80 }, 20, createCanvasCandidateWorkBudget()).target,
    ).toBeNull()
  })

  it('refuses an uncertain connection target after the gesture budget is exhausted', () => {
    const budget = createCanvasCandidateWorkBudget()
    let consumed = 0
    while (budget.consume()) consumed += 1

    expect(consumed).toBe(CANVAS_WORKLOAD_LIMITS.candidateWorkPerQuery)
    expect(
      createCanvasConnectionCandidateIndex(NODES).find(NODE_A, { x: 302, y: 80 }, 20, budget)
        .target,
    ).toBeNull()
    expect(budget.exhausted).toBe(true)
  })
})

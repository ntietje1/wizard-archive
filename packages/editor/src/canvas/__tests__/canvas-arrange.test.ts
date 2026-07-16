import { describe, expect, it } from 'vite-plus/test'
import { createCanvasArrangeChange } from '../canvas-arrange'
import type { CanvasDocumentChange } from '../document-controller'
import type { CanvasDocumentContent, CanvasDocumentNode } from '../document-contract'
import { assertDomainId, DOMAIN_ID_KIND } from '../../resources/domain-id'

const NODE_A = assertDomainId(DOMAIN_ID_KIND.canvasNode, '01890f47-65f2-7cc0-8a3b-111111111111')
const NODE_B = assertDomainId(DOMAIN_ID_KIND.canvasNode, '01890f47-65f2-7cc0-8a3b-222222222222')
const NODE_C = assertDomainId(DOMAIN_ID_KIND.canvasNode, '01890f47-65f2-7cc0-8a3b-333333333333')

const CONTENT: CanvasDocumentContent = {
  nodes: [
    createNode(NODE_A, 30, 10, 20, 10),
    createNode(NODE_B, 10, 50, 40, 20),
    createNode(NODE_C, 80, 25, 10, 30),
  ],
  edges: [],
}
const SELECTION = { nodeIds: new Set([NODE_A, NODE_B, NODE_C]), edgeIds: new Set<string>() }
type CanvasArrangeAction = Parameters<typeof createCanvasArrangeChange>[2]

describe('canvas arrange geometry', () => {
  it.each([
    [
      'alignLeft',
      [
        [10, 10],
        [10, 50],
        [10, 25],
      ],
    ],
    [
      'alignRight',
      [
        [70, 10],
        [50, 50],
        [80, 25],
      ],
    ],
    [
      'alignTop',
      [
        [30, 10],
        [10, 10],
        [80, 10],
      ],
    ],
    [
      'alignBottom',
      [
        [30, 60],
        [10, 50],
        [80, 40],
      ],
    ],
    [
      'alignCenter',
      [
        [40, 35],
        [30, 30],
        [45, 25],
      ],
    ],
    [
      'alignVertical',
      [
        [40, 10],
        [30, 50],
        [45, 25],
      ],
    ],
    [
      'alignHorizontal',
      [
        [30, 35],
        [10, 30],
        [80, 25],
      ],
    ],
    [
      'flipHorizontal',
      [
        [50, 10],
        [50, 50],
        [10, 25],
      ],
    ],
    [
      'flipVertical',
      [
        [30, 60],
        [10, 10],
        [80, 25],
      ],
    ],
  ] satisfies ReadonlyArray<
    readonly [CanvasArrangeAction, ReadonlyArray<readonly [number, number]>]
  >)('%s', (action, expected) => {
    expect(
      arrangedPositions(CONTENT, createCanvasArrangeChange(CONTENT, SELECTION, action)),
    ).toEqual(expected)
  })

  it('distributes unequal node sizes with equal gaps while keeping outer bounds fixed', () => {
    const content = {
      nodes: [
        createNode(NODE_A, 0, 50, 20, 10),
        createNode(NODE_B, 80, 0, 10, 20),
        createNode(NODE_C, 140, 100, 40, 30),
      ],
      edges: [],
    }
    expect(
      arrangedPositions(
        content,
        createCanvasArrangeChange(content, SELECTION, 'distributeHorizontal'),
      ),
    ).toEqual([
      [0, 50],
      [75, 0],
      [140, 100],
    ])
    expect(
      arrangedPositions(
        content,
        createCanvasArrangeChange(content, SELECTION, 'distributeVertical'),
      ),
    ).toEqual([
      [0, 55],
      [80, 0],
      [140, 100],
    ])
  })

  it('rejects undersized and no-op selections', () => {
    expect(
      createCanvasArrangeChange(
        CONTENT,
        { nodeIds: new Set([NODE_A]), edgeIds: new Set() },
        'alignLeft',
      ),
    ).toBeNull()
    expect(
      createCanvasArrangeChange(
        CONTENT,
        { nodeIds: new Set([NODE_A, NODE_B]), edgeIds: new Set() },
        'distributeHorizontal',
      ),
    ).toBeNull()
    const aligned = {
      nodes: [createNode(NODE_A, 10, 0, 20, 10), createNode(NODE_B, 10, 40, 20, 10)],
      edges: [],
    }
    expect(
      createCanvasArrangeChange(
        aligned,
        { nodeIds: new Set([NODE_A, NODE_B]), edgeIds: new Set() },
        'alignLeft',
      ),
    ).toBeNull()
  })
})

function createNode(
  id: typeof NODE_A,
  x: number,
  y: number,
  width: number,
  height: number,
): CanvasDocumentNode {
  return { id, type: 'text', position: { x, y }, width, height, data: {} }
}

function arrangedPositions(content: CanvasDocumentContent, change: CanvasDocumentChange | null) {
  if (!change || change.type !== 'replace') throw new Error('Expected canvas arrange replacement')
  const changed = new Map(change.nodes.map((changedNode) => [changedNode.id, changedNode.position]))
  return content.nodes.map((contentNode) => {
    const position = changed.get(contentNode.id) ?? contentNode.position
    return [position.x, position.y]
  })
}

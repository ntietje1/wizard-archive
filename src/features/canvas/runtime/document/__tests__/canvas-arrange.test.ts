import { afterEach, describe, expect, it, vi } from 'vitest'
import { createCanvasArrangePlan } from '../canvas-arrange'
import type { CanvasDocumentNode as Node } from '~/features/canvas/types/canvas-domain-types'
import * as Y from 'yjs'

vi.mock('~/features/canvas/nodes/shared/canvas-node-bounds', () => ({
  getCanvasNodeBounds: (node: Node) => {
    if (typeof node.width !== 'number' || typeof node.height !== 'number') {
      return null
    }

    const dataBounds =
      typeof node.data === 'object' && node.data !== null && 'bounds' in node.data
        ? node.data.bounds
        : null
    if (dataBounds && typeof dataBounds === 'object' && 'x' in dataBounds && 'y' in dataBounds) {
      return { x: dataBounds.x, y: dataBounds.y, width: node.width, height: node.height }
    }

    return {
      x: node.position.x,
      y: node.position.y,
      width: node.width,
      height: node.height,
    }
  },
}))

function createNode(id: string, x: number, y: number, width: number, height: number): Node {
  return {
    id,
    type: 'text',
    position: { x, y },
    width,
    height,
    data: {},
  } satisfies Node
}

function createOffsetNode(
  id: string,
  positionX: number,
  positionY: number,
  boundsX: number,
  boundsY: number,
  width: number,
  height: number,
): Node {
  return {
    id,
    type: 'text',
    position: { x: positionX, y: positionY },
    width,
    height,
    data: {
      bounds: { x: boundsX, y: boundsY, width, height },
    },
  } as Node
}

function createNodesMap(nodes: Array<Node>) {
  const doc = new Y.Doc()
  createdDocs.push(doc)
  const nodesMap = doc.getMap<Node>('nodes')
  for (const node of nodes) {
    nodesMap.set(node.id, node)
  }

  return { doc, nodesMap }
}

function createSelection(nodeIds: Array<string>) {
  return {
    nodeIds: new Set(nodeIds),
    edgeIds: new Set<string>(),
  }
}

function planPositions(plan: ReturnType<typeof createCanvasArrangePlan>) {
  return Array.from(plan ?? [])
    .sort(([leftId], [rightId]) => leftId.localeCompare(rightId))
    .map(([id, position]) => ({ id, ...position }))
}

const createdDocs: Array<Y.Doc> = []

afterEach(() => {
  for (const doc of createdDocs) {
    doc.destroy()
  }
  createdDocs.length = 0
})

describe('createCanvasArrangePlan', () => {
  it('aligns selected node bounds to each shared edge', () => {
    const { nodesMap } = createNodesMap([
      createNode('a', 30, 10, 20, 10),
      createNode('b', 10, 50, 40, 20),
      createNode('c', 80, 25, 10, 30),
    ])
    const selection = createSelection(['a', 'b', 'c'])

    expect(planPositions(createCanvasArrangePlan(nodesMap, selection, 'alignLeft'))).toEqual([
      { id: 'a', x: 10, y: 10 },
      { id: 'b', x: 10, y: 50 },
      { id: 'c', x: 10, y: 25 },
    ])
    expect(planPositions(createCanvasArrangePlan(nodesMap, selection, 'alignRight'))).toEqual([
      { id: 'a', x: 70, y: 10 },
      { id: 'b', x: 50, y: 50 },
      { id: 'c', x: 80, y: 25 },
    ])
    expect(planPositions(createCanvasArrangePlan(nodesMap, selection, 'alignTop'))).toEqual([
      { id: 'a', x: 30, y: 10 },
      { id: 'b', x: 10, y: 10 },
      { id: 'c', x: 80, y: 10 },
    ])
    expect(planPositions(createCanvasArrangePlan(nodesMap, selection, 'alignBottom'))).toEqual([
      { id: 'a', x: 30, y: 60 },
      { id: 'b', x: 10, y: 50 },
      { id: 'c', x: 80, y: 40 },
    ])
  })

  it('preserves node position offsets when aligning bounds to a shared edge', () => {
    const { nodesMap } = createNodesMap([
      createOffsetNode('a', 5, 23, 0, 20, 20, 10),
      createOffsetNode('b', 47, 4, 50, 0, 10, 20),
      createOffsetNode('c', 110, 75, 100, 80, 40, 30),
    ])
    const selection = createSelection(['a', 'b', 'c'])

    expect(planPositions(createCanvasArrangePlan(nodesMap, selection, 'alignLeft'))).toEqual([
      { id: 'a', x: 5, y: 23 },
      { id: 'b', x: -3, y: 4 },
      { id: 'c', x: 10, y: 75 },
    ])
    expect(planPositions(createCanvasArrangePlan(nodesMap, selection, 'alignRight'))).toEqual([
      { id: 'a', x: 125, y: 23 },
      { id: 'b', x: 127, y: 4 },
      { id: 'c', x: 110, y: 75 },
    ])
    expect(planPositions(createCanvasArrangePlan(nodesMap, selection, 'alignTop'))).toEqual([
      { id: 'a', x: 5, y: 3 },
      { id: 'b', x: 47, y: 4 },
      { id: 'c', x: 110, y: -5 },
    ])
    expect(planPositions(createCanvasArrangePlan(nodesMap, selection, 'alignBottom'))).toEqual([
      { id: 'a', x: 5, y: 103 },
      { id: 'b', x: 47, y: 94 },
      { id: 'c', x: 110, y: 75 },
    ])
  })

  it('distributes selected node bounds with equal gaps while keeping outer nodes fixed', () => {
    const { nodesMap } = createNodesMap([
      createNode('a', 0, 50, 20, 10),
      createNode('b', 80, 0, 10, 20),
      createNode('c', 140, 100, 40, 30),
    ])
    const selection = createSelection(['a', 'b', 'c'])

    expect(
      planPositions(createCanvasArrangePlan(nodesMap, selection, 'distributeHorizontal')),
    ).toEqual([
      { id: 'a', x: 0, y: 50 },
      { id: 'b', x: 75, y: 0 },
      { id: 'c', x: 140, y: 100 },
    ])
    expect(
      planPositions(createCanvasArrangePlan(nodesMap, selection, 'distributeVertical')),
    ).toEqual([
      { id: 'a', x: 0, y: 55 },
      { id: 'b', x: 80, y: 0 },
      { id: 'c', x: 140, y: 100 },
    ])
  })

  it('preserves node position offsets when distributing bounds', () => {
    const { nodesMap } = createNodesMap([
      createOffsetNode('a', 5, 23, 0, 20, 20, 10),
      createOffsetNode('b', 47, 4, 50, 0, 10, 20),
      createOffsetNode('c', 110, 75, 100, 80, 40, 30),
    ])
    const selection = createSelection(['a', 'b', 'c'])

    expect(
      planPositions(createCanvasArrangePlan(nodesMap, selection, 'distributeHorizontal')),
    ).toEqual([
      { id: 'a', x: 5, y: 23 },
      { id: 'b', x: 52, y: 4 },
      { id: 'c', x: 110, y: 75 },
    ])
    expect(
      planPositions(createCanvasArrangePlan(nodesMap, selection, 'distributeVertical')),
    ).toEqual([
      { id: 'a', x: 5, y: 48 },
      { id: 'b', x: 47, y: 4 },
      { id: 'c', x: 110, y: 75 },
    ])
  })

  it('flips selected node bounds across the aggregate center', () => {
    const { nodesMap } = createNodesMap([
      createNode('a', 0, 0, 20, 10),
      createNode('b', 80, 30, 10, 20),
      createNode('c', 140, 100, 40, 30),
    ])
    const selection = createSelection(['a', 'b', 'c'])

    expect(planPositions(createCanvasArrangePlan(nodesMap, selection, 'flipHorizontal'))).toEqual([
      { id: 'a', x: 160, y: 0 },
      { id: 'b', x: 90, y: 30 },
      { id: 'c', x: 0, y: 100 },
    ])
    expect(planPositions(createCanvasArrangePlan(nodesMap, selection, 'flipVertical'))).toEqual([
      { id: 'a', x: 0, y: 120 },
      { id: 'b', x: 80, y: 80 },
      { id: 'c', x: 140, y: 0 },
    ])
  })

  it('returns null when the selected nodes cannot satisfy the action', () => {
    const { nodesMap } = createNodesMap([
      createNode('a', 0, 0, 20, 10),
      createNode('b', 80, 30, 10, 20),
    ])

    expect(createCanvasArrangePlan(nodesMap, createSelection(['a']), 'alignLeft')).toBeNull()
    expect(
      createCanvasArrangePlan(nodesMap, createSelection(['a', 'b']), 'distributeHorizontal'),
    ).toBeNull()
    expect(
      createCanvasArrangePlan(
        nodesMap,
        createSelection(['missing-a', 'missing-b']),
        'flipVertical',
      ),
    ).toBeNull()
  })
})

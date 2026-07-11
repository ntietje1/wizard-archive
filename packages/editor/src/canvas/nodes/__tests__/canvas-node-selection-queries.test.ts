import { describe, expect, it } from 'vite-plus/test'
import type { CanvasDocumentNode as Node } from '../../document-contract'
import {
  getCanvasNodesMatchingLasso,
  getCanvasNodesMatchingRectangle,
} from '../canvas-node-selection-queries'

describe('canvas node selection queries', () => {
  it('uses default rectangular selection behavior for rectangle-shaped nodes', () => {
    const nodes: Array<Node> = [
      {
        id: 'text-1',
        type: 'text',
        position: { x: 10, y: 10 },
        width: 80,
        height: 80,
        data: {},
      },
    ]

    expect(
      getCanvasNodesMatchingRectangle(nodes, { x: 0, y: 0, width: 100, height: 100 }, { zoom: 1 }),
    ).toEqual(new Set(['text-1']))
    expect(
      getCanvasNodesMatchingLasso(
        nodes,
        [
          { x: 0, y: 0 },
          { x: 30, y: 0 },
          { x: 30, y: 30 },
          { x: 0, y: 30 },
        ],
        { zoom: 1 },
      ),
    ).toEqual(new Set(['text-1']))
  })

  it('selects text nodes when the drag rectangle only partially overlaps them', () => {
    const nodes: Array<Node> = [
      {
        id: 'text-1',
        type: 'text',
        position: { x: 10, y: 10 },
        width: 80,
        height: 80,
        data: {},
      },
    ]

    expect(
      getCanvasNodesMatchingRectangle(nodes, { x: 0, y: 0, width: 30, height: 30 }, { zoom: 1 }),
    ).toEqual(new Set(['text-1']))
  })

  it('uses bespoke stroke selection behavior and safely ignores unknown node types', () => {
    const nodes: Array<Node> = [
      {
        id: 'unknown-1',
        type: 'unknown',
        position: { x: 0, y: 0 },
        width: 10,
        height: 10,
        data: {},
      } as unknown as Node,
      createStrokeNode(),
    ]

    expect(
      getCanvasNodesMatchingRectangle(nodes, { x: 0, y: 0, width: 40, height: 40 }, { zoom: 1 }),
    ).toEqual(new Set(['stroke-1']))
    expect(
      getCanvasNodesMatchingLasso(
        nodes,
        [
          { x: 0, y: 0 },
          { x: 60, y: 0 },
          { x: 60, y: 40 },
          { x: 0, y: 40 },
        ],
        { zoom: 1 },
      ),
    ).toEqual(new Set(['stroke-1']))
  })

  it('uses the same padded stroke hit detection for rectangle selection as point selection', () => {
    const nodes: Array<Node> = [createStrokeNode()]

    expect(
      getCanvasNodesMatchingRectangle(nodes, { x: 40, y: 20, width: 20, height: 1 }, { zoom: 1 }),
    ).toEqual(new Set(['stroke-1']))
  })

  it('uses padded stroke candidate bounds for lasso selection', () => {
    const nodes: Array<Node> = [createStrokeNode()]

    expect(
      getCanvasNodesMatchingLasso(
        nodes,
        [
          { x: 40, y: 20 },
          { x: 60, y: 20 },
          { x: 60, y: 21 },
          { x: 40, y: 21 },
        ],
        { zoom: 1 },
      ),
    ).toEqual(new Set(['stroke-1']))
  })
  it('selects moved strokes using their rendered position', () => {
    const nodes: Array<Node> = [
      createStrokeNode({
        position: { x: 420, y: 240 },
        bounds: { x: 120, y: 40, width: 100, height: 20 },
        points: [
          [120, 50, 0.5],
          [220, 50, 0.5],
        ],
      }),
    ]

    expect(
      getCanvasNodesMatchingRectangle(
        nodes,
        { x: 460, y: 245, width: 20, height: 10 },
        { zoom: 1 },
      ),
    ).toEqual(new Set(['stroke-1']))
  })

  it('ignores malformed stroke payloads during rectangle selection candidate filtering', () => {
    const nodes: Array<Node> = [
      {
        id: 'stroke-invalid',
        type: 'stroke',
        position: { x: 0, y: 0 },
        width: 100,
        height: 20,
        data: {
          bounds: { x: 0, y: 0, width: 100, height: 20 },
          points: [[0, 10, 'bad']],
          size: 4,
        },
      } as unknown as Node,
      {
        id: 'text-1',
        type: 'text',
        position: { x: 10, y: 10 },
        width: 80,
        height: 80,
        data: {},
      },
    ]

    expect(
      getCanvasNodesMatchingRectangle(nodes, { x: 0, y: 0, width: 100, height: 100 }, { zoom: 1 }),
    ).toEqual(new Set(['text-1']))
    expect(
      getCanvasNodesMatchingLasso(
        nodes,
        [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 100, y: 100 },
          { x: 0, y: 100 },
        ],
        { zoom: 1 },
      ),
    ).toEqual(new Set(['text-1']))
  })
})

function createStrokeNode({
  bounds = { x: 0, y: 0, width: 100, height: 20 },
  id = 'stroke-1',
  points = [
    [0, 10, 0.5],
    [100, 10, 0.5],
  ],
  position = { x: 0, y: 0 },
}: {
  bounds?: { x: number; y: number; width: number; height: number }
  id?: string
  points?: Array<[number, number, number]>
  position?: { x: number; y: number }
} = {}): Node {
  return {
    id,
    type: 'stroke',
    position,
    width: bounds.width,
    height: bounds.height,
    data: {
      bounds,
      points,
      color: 'var(--foreground)',
      size: 4,
    },
  }
}

import { describe, expect, it } from 'vitest'
import {
  findCanvasNodeAtPoint,
  getCanvasNodesMatchingLasso,
  getCanvasNodesMatchingRectangle,
} from '../canvas-node-selection-queries'
import type { CanvasDocumentNode as Node } from '~/features/canvas/types/canvas-domain-types'

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

    expect(findCanvasNodeAtPoint(nodes, { x: 20, y: 20 }, { zoom: 1 })).toBe('text-1')
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
      {
        id: 'stroke-1',
        type: 'stroke',
        position: { x: 0, y: 0 },
        width: 100,
        height: 20,
        data: {
          bounds: { x: 0, y: 0, width: 100, height: 20 },
          points: [
            [0, 10, 0.5],
            [100, 10, 0.5],
          ],
          color: 'var(--foreground)',
          size: 4,
        },
      },
    ]

    expect(findCanvasNodeAtPoint(nodes, { x: 50, y: 20 }, { zoom: 1 })).toBe('stroke-1')
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
    const nodes: Array<Node> = [
      {
        id: 'stroke-1',
        type: 'stroke',
        position: { x: 0, y: 0 },
        width: 100,
        height: 20,
        data: {
          bounds: { x: 0, y: 0, width: 100, height: 20 },
          points: [
            [0, 10, 0.5],
            [100, 10, 0.5],
          ],
          color: 'var(--foreground)',
          size: 4,
        },
      },
    ]

    expect(findCanvasNodeAtPoint(nodes, { x: 50, y: 20 }, { zoom: 1 })).toBe('stroke-1')
    expect(
      getCanvasNodesMatchingRectangle(nodes, { x: 40, y: 20, width: 20, height: 1 }, { zoom: 1 }),
    ).toEqual(new Set(['stroke-1']))
  })

  it('hit-tests moved strokes using their rendered position', () => {
    const nodes: Array<Node> = [
      {
        id: 'stroke-1',
        type: 'stroke',
        position: { x: 420, y: 240 },
        width: 100,
        height: 20,
        data: {
          bounds: { x: 120, y: 40, width: 100, height: 20 },
          points: [
            [120, 50, 0.5],
            [220, 50, 0.5],
          ],
          color: 'var(--foreground)',
          size: 4,
        },
      },
    ]

    expect(findCanvasNodeAtPoint(nodes, { x: 470, y: 250 }, { zoom: 1 })).toBe('stroke-1')
  })

  it('does not treat the open interior of a concave stroke as clickable', () => {
    const nodes: Array<Node> = [
      {
        id: 'stroke-u',
        type: 'stroke',
        position: { x: 0, y: 0 },
        width: 100,
        height: 100,
        data: {
          bounds: { x: 0, y: 0, width: 100, height: 100 },
          points: [
            [20, 20, 0.5],
            [20, 80, 0.5],
            [80, 80, 0.5],
            [80, 20, 0.5],
          ],
          color: 'var(--foreground)',
          size: 4,
        },
      },
    ]

    expect(findCanvasNodeAtPoint(nodes, { x: 50, y: 40 }, { zoom: 1 })).toBeNull()
    expect(findCanvasNodeAtPoint(nodes, { x: 20, y: 50 }, { zoom: 1 })).toBe('stroke-u')
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
    expect(findCanvasNodeAtPoint(nodes, { x: 10, y: 10 }, { zoom: 1 })).toBe('text-1')
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

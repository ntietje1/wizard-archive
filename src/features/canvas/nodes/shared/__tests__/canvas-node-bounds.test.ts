import { describe, expect, it } from 'vitest'
import { getCanvasNodeBounds } from '../canvas-node-bounds'
import type { CanvasDocumentNode as Node } from '~/features/canvas/types/canvas-domain-types'

function asNode(value: unknown): Node {
  return value as Node
}

describe('getCanvasNodeBounds', () => {
  it('uses measured node dimensions when width and height are present', () => {
    const node = asNode({
      id: 'node-1',
      type: 'text',
      position: { x: 20, y: 40 },
      width: 120,
      height: 36,
      data: {
        bounds: { x: 0, y: 0, width: 999, height: 999 },
      },
    })

    expect(getCanvasNodeBounds(node)).toEqual({
      x: 20,
      y: 40,
      width: 120,
      height: 36,
    })
  })

  it('falls back to persisted local bounds dimensions when measured size is absent', () => {
    const node = asNode({
      id: 'node-1',
      type: 'stroke',
      position: { x: 5, y: 10 },
      data: {
        bounds: { x: 0, y: 0, width: 40, height: 20 },
      },
    })

    expect(getCanvasNodeBounds(node)).toEqual({
      x: 5,
      y: 10,
      width: 40,
      height: 20,
    })
  })

  it('returns null when neither measured size nor local bounds are available', () => {
    const node: Node = {
      id: 'node-1',
      type: 'text',
      position: { x: 0, y: 0 },
      data: {},
    }

    expect(getCanvasNodeBounds(node)).toBeNull()
  })

  it('returns null when only one measured dimension is present', () => {
    expect(
      getCanvasNodeBounds({
        id: 'node-width-only',
        type: 'text',
        position: { x: 0, y: 0 },
        width: 120,
        data: {},
      }),
    ).toBeNull()

    expect(
      getCanvasNodeBounds({
        id: 'node-height-only',
        type: 'text',
        position: { x: 0, y: 0 },
        height: 36,
        data: {},
      }),
    ).toBeNull()
  })

  it('returns null when persisted bounds are missing width or height', () => {
    expect(
      getCanvasNodeBounds({
        id: 'node-missing-bounds-width',
        type: 'text',
        position: { x: 0, y: 0 },
        data: { bounds: { x: 0, y: 0, height: 36 } },
      } as unknown as Node),
    ).toBeNull()

    expect(
      getCanvasNodeBounds({
        id: 'node-missing-bounds-height',
        type: 'text',
        position: { x: 0, y: 0 },
        data: { bounds: { x: 0, y: 0, width: 120 } },
      } as unknown as Node),
    ).toBeNull()
  })

  it('returns null when persisted bounds dimensions are not finite numbers', () => {
    expect(
      getCanvasNodeBounds({
        id: 'node-invalid-bounds-width',
        type: 'text',
        position: { x: 0, y: 0 },
        data: { bounds: { x: 0, y: 0, width: 'bad', height: 36 } },
      } as unknown as Node),
    ).toBeNull()

    expect(
      getCanvasNodeBounds({
        id: 'node-invalid-bounds-height',
        type: 'text',
        position: { x: 0, y: 0 },
        data: { bounds: { x: 0, y: 0, width: 120, height: Number.NaN } },
      } as unknown as Node),
    ).toBeNull()

    expect(
      getCanvasNodeBounds({
        id: 'node-invalid-bounds-width-infinite',
        type: 'text',
        position: { x: 0, y: 0 },
        data: { bounds: { x: 0, y: 0, width: Number.POSITIVE_INFINITY, height: 36 } },
      } as unknown as Node),
    ).toBeNull()

    expect(
      getCanvasNodeBounds({
        id: 'node-invalid-bounds-height-negative-infinite',
        type: 'text',
        position: { x: 0, y: 0 },
        data: { bounds: { x: 0, y: 0, width: 120, height: Number.NEGATIVE_INFINITY } },
      } as unknown as Node),
    ).toBeNull()
  })

  it('preserves explicit zero dimensions', () => {
    const node: Node = {
      id: 'node-zero-size',
      type: 'text',
      position: { x: 10, y: 12 },
      width: 0,
      height: 0,
      data: {},
    }

    expect(getCanvasNodeBounds(node)).toEqual({
      x: 10,
      y: 12,
      width: 0,
      height: 0,
    })
  })
})

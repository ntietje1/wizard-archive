import { describe, expect, it } from 'vite-plus/test'
import { getCanvasNodeBounds } from '../canvas-node-bounds'
import type { CanvasDocumentNode as Node } from '../../../document-contract'
/**
 * asNode(value: unknown): Node force-casts malformed shapes for testing purposes only.
 * Use it for invalid node shapes or edge cases the type system would normally reject.
 * Prefer real Node instances when the test is not covering type-system edge cases.
 */
function asNode(value: unknown): Node {
  return value as Node
}

describe('getCanvasNodeBounds', () => {
  it('uses measured node dimensions when width and height are present', () => {
    const node = makeNode({
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
    const node = makeNode({
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

  it('uses persisted local bounds as a pair when only one measured dimension exists', () => {
    expect(
      getCanvasNodeBounds(
        makeNode({
          id: 'node-width-only',
          type: 'stroke',
          position: { x: 5, y: 10 },
          width: 120,
          data: {
            bounds: { x: 0, y: 0, width: 40, height: 20 },
          },
        }),
      ),
    ).toEqual({
      x: 5,
      y: 10,
      width: 40,
      height: 20,
    })

    expect(
      getCanvasNodeBounds(
        makeNode({
          id: 'node-height-only',
          type: 'stroke',
          position: { x: 5, y: 10 },
          height: 36,
          data: {
            bounds: { x: 0, y: 0, width: 40, height: 20 },
          },
        }),
      ),
    ).toEqual({
      x: 5,
      y: 10,
      width: 40,
      height: 20,
    })
  })

  it('returns null when neither measured size nor local bounds are available', () => {
    expect(getCanvasNodeBounds(makeNode())).toBeNull()
  })

  it('returns null when only one measured dimension is present', () => {
    expect(
      getCanvasNodeBounds(
        makeNode({
          id: 'node-width-only',
          width: 120,
        }),
      ),
    ).toBeNull()

    expect(
      getCanvasNodeBounds(
        makeNode({
          id: 'node-height-only',
          height: 36,
        }),
      ),
    ).toBeNull()
  })

  it('returns null when persisted bounds are missing width or height', () => {
    expect(
      getCanvasNodeBounds(
        makeNode({
          id: 'node-missing-bounds-width',
          data: { bounds: { x: 0, y: 0, height: 36 } },
        }),
      ),
    ).toBeNull()

    expect(
      getCanvasNodeBounds(
        makeNode({
          id: 'node-missing-bounds-height',
          data: { bounds: { x: 0, y: 0, width: 120 } },
        }),
      ),
    ).toBeNull()
  })

  it('returns null when persisted bounds dimensions are not finite numbers', () => {
    expect(
      getCanvasNodeBounds(
        makeNode({
          id: 'node-invalid-bounds-width',
          data: { bounds: { x: 0, y: 0, width: 'bad', height: 36 } },
        }),
      ),
    ).toBeNull()

    expect(
      getCanvasNodeBounds(
        makeNode({
          id: 'node-invalid-bounds-height',
          data: { bounds: { x: 0, y: 0, width: 120, height: Number.NaN } },
        }),
      ),
    ).toBeNull()

    expect(
      getCanvasNodeBounds(
        makeNode({
          id: 'node-invalid-bounds-width-infinite',
          data: { bounds: { x: 0, y: 0, width: Number.POSITIVE_INFINITY, height: 36 } },
        }),
      ),
    ).toBeNull()

    expect(
      getCanvasNodeBounds(
        makeNode({
          id: 'node-invalid-bounds-height-negative-infinite',
          data: { bounds: { x: 0, y: 0, width: 120, height: Number.NEGATIVE_INFINITY } },
        }),
      ),
    ).toBeNull()
  })

  it('returns null when dimensions are negative', () => {
    expect(
      getCanvasNodeBounds(
        makeNode({
          id: 'node-negative-width',
          width: -1,
          height: 36,
        }),
      ),
    ).toBeNull()

    expect(
      getCanvasNodeBounds(
        makeNode({
          id: 'node-negative-bounds-height',
          data: { bounds: { x: 0, y: 0, width: 120, height: -1 } },
        }),
      ),
    ).toBeNull()
  })

  it('returns null when node position is not finite', () => {
    expect(
      getCanvasNodeBounds(
        makeNode({
          id: 'node-invalid-position-x',
          position: { x: Number.NaN, y: 0 },
          width: 120,
          height: 36,
        }),
      ),
    ).toBeNull()

    expect(
      getCanvasNodeBounds(
        makeNode({
          id: 'node-invalid-position-y',
          position: { x: 0, y: Number.POSITIVE_INFINITY },
          width: 120,
          height: 36,
        }),
      ),
    ).toBeNull()
  })

  it('preserves explicit zero dimensions', () => {
    const node = makeNode({
      id: 'node-zero-size',
      position: { x: 10, y: 12 },
      width: 0,
      height: 0,
    })

    expect(getCanvasNodeBounds(node)).toEqual({
      x: 10,
      y: 12,
      width: 0,
      height: 0,
    })
  })
})

function makeNode(overrides: Record<string, unknown> = {}): Node {
  return asNode({
    id: 'node-1',
    type: 'text',
    position: { x: 0, y: 0 },
    data: {},
    ...overrides,
  })
}

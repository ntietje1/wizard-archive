import { describe, expect, it } from 'vitest'
import { reorderCanvasElementIds } from '../canvas-reorder'
import { getNextCanvasElementZIndex } from '../canvas-z-index'
import { applyCanvasZOrder, sortCanvasElementsByZIndex } from '../canvas-z-order'

describe('canvas z-order helpers', () => {
  it('returns the base z-index when there are no elements', () => {
    expect(getNextCanvasElementZIndex([])).toBe(1)
    expect(sortCanvasElementsByZIndex([])).toEqual([])
  })

  it('sorts render order without renormalizing persisted zIndex values', () => {
    const elements = [
      { id: 'node-2', zIndex: 10 },
      { id: 'node-1', zIndex: 4 },
    ]

    expect(sortCanvasElementsByZIndex(elements)).toEqual([
      { id: 'node-1', zIndex: 4 },
      { id: 'node-2', zIndex: 10 },
    ])
  })

  it('preserves original order when multiple elements share the same z-index', () => {
    const elements = [
      { id: 'node-1', zIndex: 4 },
      { id: 'node-2', zIndex: 4 },
      { id: 'node-3', zIndex: 4 },
    ]

    expect(sortCanvasElementsByZIndex(elements).map((element) => element.id)).toEqual([
      'node-1',
      'node-2',
      'node-3',
    ])
  })

  it('allocates the next persisted zIndex above the highest existing value', () => {
    expect(
      getNextCanvasElementZIndex([
        { id: 'node-1', zIndex: 4 },
        { id: 'node-2', zIndex: 10 },
      ]),
    ).toBe(11)
  })

  it('reorders ids independently from zIndex assignment and applies normalized persisted order', () => {
    const elements = [
      { id: 'node-1', zIndex: 1 },
      { id: 'node-2', zIndex: 2 },
      { id: 'node-3', zIndex: 3 },
    ]

    const orderedIds = reorderCanvasElementIds(
      elements.map((element) => element.id),
      ['node-1'],
      'bringToFront',
    )

    expect(orderedIds).toEqual(['node-2', 'node-3', 'node-1'])
    expect(applyCanvasZOrder(elements, orderedIds)).toEqual([
      { id: 'node-2', zIndex: 1 },
      { id: 'node-3', zIndex: 2 },
      { id: 'node-1', zIndex: 3 },
    ])
  })
})

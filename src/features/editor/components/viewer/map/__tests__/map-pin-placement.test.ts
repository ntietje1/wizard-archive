import { describe, expect, it } from 'vitest'
import { buildMapPinPlacementInputs } from '../map-pin-placement'
import { testId } from '~/test/helpers/test-id'

describe('buildMapPinPlacementInputs', () => {
  it('handles empty itemIds array', () => {
    expect(buildMapPinPlacementInputs([], { x: 50, y: 25 })).toEqual([])
  })

  it('places a single pin at the requested position', () => {
    const itemId = testId<'sidebarItems'>('note_1')

    expect(buildMapPinPlacementInputs([itemId], { x: 50, y: 25 })).toEqual([
      { itemId, x: 50, y: 25 },
    ])
  })

  it('spreads multiple pins around the requested position', () => {
    const itemIds = [
      testId<'sidebarItems'>('note_1'),
      testId<'sidebarItems'>('note_2'),
      testId<'sidebarItems'>('note_3'),
    ]

    expect(buildMapPinPlacementInputs(itemIds, { x: 50, y: 25 })).toEqual([
      { itemId: itemIds[0], x: 48, y: 25 },
      { itemId: itemIds[1], x: 50, y: 25 },
      { itemId: itemIds[2], x: 52, y: 25 },
    ])
  })

  it('spreads even-numbered pins around the requested position', () => {
    const itemIds = [
      testId<'sidebarItems'>('note_1'),
      testId<'sidebarItems'>('note_2'),
      testId<'sidebarItems'>('note_3'),
      testId<'sidebarItems'>('note_4'),
    ]

    expect(buildMapPinPlacementInputs(itemIds, { x: 50, y: 25 })).toEqual([
      { itemId: itemIds[0], x: 47, y: 25 },
      { itemId: itemIds[1], x: 49, y: 25 },
      { itemId: itemIds[2], x: 51, y: 25 },
      { itemId: itemIds[3], x: 53, y: 25 },
    ])
  })

  it('clamps generated pin positions to map bounds', () => {
    const itemIds = [
      testId<'sidebarItems'>('note_1'),
      testId<'sidebarItems'>('note_2'),
      testId<'sidebarItems'>('note_3'),
    ]

    expect(buildMapPinPlacementInputs(itemIds, { x: 0, y: 100 })).toEqual([
      { itemId: itemIds[0], x: 0, y: 100 },
      { itemId: itemIds[1], x: 0, y: 100 },
      { itemId: itemIds[2], x: 2, y: 100 },
    ])
  })

  it('clamps generated pin positions to upper map bounds', () => {
    const itemIds = [
      testId<'sidebarItems'>('note_1'),
      testId<'sidebarItems'>('note_2'),
      testId<'sidebarItems'>('note_3'),
    ]

    expect(buildMapPinPlacementInputs(itemIds, { x: 100, y: 0 })).toEqual([
      { itemId: itemIds[0], x: 98, y: 0 },
      { itemId: itemIds[1], x: 100, y: 0 },
      { itemId: itemIds[2], x: 100, y: 0 },
    ])
  })
})

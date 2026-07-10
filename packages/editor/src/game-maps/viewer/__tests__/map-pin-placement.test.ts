import { describe, expect, it } from 'vite-plus/test'
import type { SidebarItemId } from '../../../../../../shared/common/ids'
import { buildMapPinPlacementInputs, getImagePinPosition } from '../map-pin-placement'

describe('buildMapPinPlacementInputs', () => {
  it('handles empty itemIds array', () => {
    expect(buildMapPinPlacementInputs([], { x: 50, y: 25 })).toEqual([])
  })

  it('places a single pin at the requested position', () => {
    const itemId = 'note_1' as SidebarItemId

    expect(buildMapPinPlacementInputs([itemId], { x: 50, y: 25 })).toEqual([
      { itemId, x: 50, y: 25 },
    ])
  })

  it('spreads multiple pins around the requested position', () => {
    const itemIds = [
      'note_1' as SidebarItemId,
      'note_2' as SidebarItemId,
      'note_3' as SidebarItemId,
    ]

    expect(buildMapPinPlacementInputs(itemIds, { x: 50, y: 25 })).toEqual([
      { itemId: itemIds[0], x: 48, y: 25 },
      { itemId: itemIds[1], x: 50, y: 25 },
      { itemId: itemIds[2], x: 52, y: 25 },
    ])
  })

  it('spreads even-numbered pins around the requested position', () => {
    const itemIds = [
      'note_1' as SidebarItemId,
      'note_2' as SidebarItemId,
      'note_3' as SidebarItemId,
      'note_4' as SidebarItemId,
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
      'note_1' as SidebarItemId,
      'note_2' as SidebarItemId,
      'note_3' as SidebarItemId,
    ]

    expect(buildMapPinPlacementInputs(itemIds, { x: 0, y: 100 })).toEqual([
      { itemId: itemIds[0], x: 0, y: 100 },
      { itemId: itemIds[1], x: 0, y: 100 },
      { itemId: itemIds[2], x: 2, y: 100 },
    ])
  })

  it('clamps generated pin positions to upper map bounds', () => {
    const itemIds = [
      'note_1' as SidebarItemId,
      'note_2' as SidebarItemId,
      'note_3' as SidebarItemId,
    ]

    expect(buildMapPinPlacementInputs(itemIds, { x: 100, y: 0 })).toEqual([
      { itemId: itemIds[0], x: 98, y: 0 },
      { itemId: itemIds[1], x: 100, y: 0 },
      { itemId: itemIds[2], x: 100, y: 0 },
    ])
  })
})

describe('getImagePinPosition', () => {
  it('converts image client coordinates to percentage coordinates', () => {
    const image = createImageWithRect({ left: 10, top: 20, width: 200, height: 100 })

    expect(getImagePinPosition(image, { clientX: 60, clientY: 45 })).toEqual({ x: 25, y: 25 })
  })

  it('clamps edge clicks that land just outside image bounds', () => {
    const image = createImageWithRect({ left: 10, top: 20, width: 200, height: 100 })

    expect(getImagePinPosition(image, { clientX: 9.5, clientY: 120.4 })).toEqual({
      x: 0,
      y: 100,
    })
  })

  it('includes the exact edge tolerance boundary', () => {
    const image = createImageWithRect({ left: 10, top: 20, width: 200, height: 100 })

    expect(getImagePinPosition(image, { clientX: 9, clientY: 120.5 })).toEqual({
      x: 0,
      y: 100,
    })
    expect(getImagePinPosition(image, { clientX: 211, clientY: 19.5 })).toEqual({
      x: 100,
      y: 0,
    })
  })

  it('rejects clicks just beyond the edge tolerance boundary', () => {
    const image = createImageWithRect({ left: 10, top: 20, width: 200, height: 100 })

    expect(getImagePinPosition(image, { clientX: 8.99, clientY: 50 })).toBeNull()
    expect(getImagePinPosition(image, { clientX: 211.01, clientY: 50 })).toBeNull()
    expect(getImagePinPosition(image, { clientX: 100, clientY: 19.49 })).toBeNull()
    expect(getImagePinPosition(image, { clientX: 100, clientY: 120.51 })).toBeNull()
  })

  it('rejects clicks that are clearly outside image bounds', () => {
    const image = createImageWithRect({ left: 10, top: 20, width: 200, height: 100 })

    expect(getImagePinPosition(image, { clientX: 8, clientY: 50 })).toBeNull()
  })
})

function createImageWithRect(rect: {
  left: number
  top: number
  width: number
  height: number
}): HTMLImageElement {
  return {
    getBoundingClientRect: () => ({ ...rect }) as DOMRect,
  } as HTMLImageElement
}

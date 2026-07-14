import type { ResourceId } from '../../resources/domain-id'
import { describe, expect, it } from 'vite-plus/test'

import { RESOURCE_STATUS } from '../../workspace/items-persistence-contract'
import { planMapPinCreations, validatePinDropTarget, validatePinTarget } from '../document-contract'

function itemId(value: string): ResourceId {
  return value as ResourceId
}

describe('planMapPinCreations', () => {
  it('accepts each available item once while preserving pin placement', () => {
    const availableItems = new Set([itemId('note-0'), itemId('note-1'), itemId('note-2')])

    const pins = planMapPinCreations({
      mapId: itemId('map-1'),
      existingPinnedItemIds: [itemId('note-0')],
      pins: [
        { itemId: itemId('map-1'), x: 10, y: 20 },
        { itemId: itemId('note-0'), x: 15, y: 25 },
        { itemId: itemId('missing-note'), x: 30, y: 40 },
        { itemId: itemId('note-1'), x: 50, y: 60 },
        { itemId: itemId('note-1'), x: 70, y: 80 },
        { itemId: itemId('note-2'), x: 90, y: 100 },
      ],
      canPinItem: (candidateId) => availableItems.has(candidateId),
      createPin: (pin) => ({
        id: `pin-${pin.itemId}`,
        itemId: pin.itemId,
        x: pin.x,
        y: pin.y,
      }),
    })

    expect(pins).toEqual([
      { id: 'pin-note-1', itemId: 'note-1', x: 50, y: 60 },
      { id: 'pin-note-2', itemId: 'note-2', x: 90, y: 100 },
    ])
  })
})

describe('pin target validation', () => {
  it('rejects self-pins through both validation entry points', () => {
    const mapId = itemId('map-1')

    expect(validatePinTarget(mapId, mapId, [])).toBe('Cannot pin a map to itself')
    expect(
      validatePinDropTarget({
        mapId,
        item: {
          id: mapId,
          workspaceId: 'workspace-1',
          status: RESOURCE_STATUS.active,
        },
        existingPinItemIds: [],
        workspaceId: 'workspace-1',
      }),
    ).toBe('self_pin')
  })

  it('rejects duplicate pins through both validation entry points', () => {
    const mapId = itemId('map-1')
    const noteId = itemId('note-1')

    expect(validatePinTarget(mapId, noteId, [noteId])).toBe('Item is already pinned on this map')
    expect(
      validatePinDropTarget({
        mapId,
        item: {
          id: noteId,
          workspaceId: 'workspace-1',
          status: RESOURCE_STATUS.active,
        },
        existingPinItemIds: [noteId],
        workspaceId: 'workspace-1',
      }),
    ).toBe('already_pinned')
  })
})

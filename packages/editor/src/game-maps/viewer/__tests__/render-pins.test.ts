import { describe, expect, it, vi } from 'vite-plus/test'
import type { MapPinId } from '../../../../../../shared/common/ids'
import { PERMISSION_LEVEL } from '../../../../../../shared/permissions/types'
import type { AnyItem } from '../../../workspace/items'
import { createWorkspaceMapRenderPins } from '../render-pins'
import {
  createGameMapFixture,
  createMapPinFixture,
  createNoteFixture,
  testId,
} from './test-fixtures'

describe('createWorkspaceMapRenderPins', () => {
  it('uses workspace permissions for pin visibility and item access', () => {
    const visibleNote = createNoteFixture({ id: testId('note-visible') })
    const hiddenNote = createNoteFixture({ id: testId('note-hidden') })
    const map = createGameMapFixture({ id: testId('map-1') })
    const visiblePin = createMapPinFixture({
      id: testId<MapPinId>('pin-visible'),
      item: visibleNote,
      map,
    })
    const hiddenPin = createMapPinFixture({
      id: testId<MapPinId>('pin-hidden'),
      item: visibleNote,
      map,
      visible: false,
    })
    const ghostPin = createMapPinFixture({
      id: testId<MapPinId>('pin-ghost'),
      item: hiddenNote,
      map,
    })
    const mapWithPins = { ...map, pins: [visiblePin, hiddenPin, ghostPin] }
    const canAccessItem = vi.fn(
      (item: AnyItem, level) => level === PERMISSION_LEVEL.VIEW && item.id !== hiddenNote.id,
    )
    const renderPins = createWorkspaceMapRenderPins({
      canAccessItem,
    })

    const result = renderPins(mapWithPins)

    expect(result.pins.map((pin) => pin.id)).toEqual(['pin-visible', 'pin-ghost'])
    expect(result.pins.filter(result.isPinGhost).map((pin) => pin.id)).toEqual(['pin-ghost'])
    expect(canAccessItem).toHaveBeenCalledWith(mapWithPins, PERMISSION_LEVEL.EDIT)
    expect(canAccessItem).toHaveBeenCalledWith(visibleNote, PERMISSION_LEVEL.VIEW)
    expect(canAccessItem).toHaveBeenCalledWith(hiddenNote, PERMISSION_LEVEL.VIEW)
  })

  it('includes hidden pins when workspace permissions grant map edit access', () => {
    const note = createNoteFixture({ id: testId('note-visible') })
    const map = createGameMapFixture({ id: testId('map-1') })
    const visiblePin = createMapPinFixture({
      id: testId<MapPinId>('pin-visible'),
      item: note,
      map,
    })
    const hiddenPin = createMapPinFixture({
      id: testId<MapPinId>('pin-hidden'),
      item: note,
      map,
      visible: false,
    })
    const mapWithPins = { ...map, pins: [visiblePin, hiddenPin] }
    const canAccessItem = vi.fn(() => true)
    const renderPins = createWorkspaceMapRenderPins({
      canAccessItem,
    })

    const result = renderPins(mapWithPins)

    expect(result.pins.map((pin) => pin.id)).toEqual(['pin-visible', 'pin-hidden'])
    expect(canAccessItem).toHaveBeenCalledWith(mapWithPins, PERMISSION_LEVEL.EDIT)
  })
})

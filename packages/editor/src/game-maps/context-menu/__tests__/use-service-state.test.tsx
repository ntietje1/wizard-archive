import { renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { MapPinId, SidebarItemId } from '../../../../../../shared/common/ids'
import { PERMISSION_LEVEL } from '../../../../../../shared/permissions/types'
import type { MapItemWithContent, MapPinWithItem } from '../../../game-maps/item-contract'
import type { NoteItem } from '../../../notes/item-contract'
import {
  RESOURCE_LOCATION,
  RESOURCE_STATUS,
  RESOURCE_TYPES,
} from '../../../workspace/items-persistence-contract'
import { MapViewProvider } from '../../viewer/map-view-context'
import { useMapPinMenuServiceState } from '../use-service-state'

describe('useMapPinMenuServiceState', () => {
  it('returns null outside a map view instead of reading published viewer state', () => {
    const { result } = renderHook(() => useMapPinMenuServiceState())

    expect(result.current).toBeNull()
  })

  it('keeps projected map view service state stable when map view inputs do not change', () => {
    const map = createGameMapFixture('map-1' as SidebarItemId, 'Map')
    const pin = createMapPin(map, 'map-pin-1' as MapPinId, 'note-1', 'Note')
    map.pins = [pin]
    const pins = [pin]
    const pinOperations = {
      removeMapPin: vi.fn(),
      updateMapPinVisibility: vi.fn(),
    }
    const requestPinMove = vi.fn()
    const requestPinPlacement = vi.fn()
    const canViewPinItem = () => true
    const wrapper = ({ children }: { children: ReactNode }) => (
      <MapViewProvider
        canEditMap
        canViewPinItem={canViewPinItem}
        map={map}
        pins={pins}
        pinOperations={pinOperations}
        requestPinMove={requestPinMove}
        requestPinPlacement={requestPinPlacement}
      >
        {children}
      </MapViewProvider>
    )

    const { result, rerender } = renderHook(() => useMapPinMenuServiceState(), { wrapper })
    const serviceState = result.current
    const activeMap = result.current?.activeMap
    const pinnedItemIds = result.current?.activeMap.pinnedItemIds

    rerender()

    expect(result.current).toBe(serviceState)
    expect(result.current?.activeMap).toBe(activeMap)
    expect(result.current?.activeMap.pinnedItemIds).toBe(pinnedItemIds)
    expect(result.current?.activeMap.pinnedItemIds.has(pin.itemId)).toBe(true)
  })
})

function createMapPin(
  map: MapItemWithContent,
  id: MapPinId,
  itemId: string,
  itemName: string,
): MapPinWithItem {
  const item = createNoteFixture(itemId as SidebarItemId, itemName)
  return {
    id: id,
    createdAt: Date.now(),
    mapId: map.id,
    itemId: item.id,
    item,
    visible: true,
    x: 50,
    y: 50,
  }
}

function createGameMapFixture(id: SidebarItemId, name: string): MapItemWithContent {
  return {
    ...createSidebarItemFixture(RESOURCE_TYPES.gameMaps, id, name),
    ancestors: [],
    imageAssetId: null,
    imageUrl: null,
    pins: [],
  } as unknown as MapItemWithContent
}

function createNoteFixture(id: SidebarItemId, name: string): NoteItem {
  return createSidebarItemFixture(RESOURCE_TYPES.notes, id, name) as unknown as NoteItem
}

function createSidebarItemFixture(type: string, id: SidebarItemId, name: string) {
  return {
    createdAt: 0,
    id: id,
    allPermissionLevel: null,
    campaignId: 'campaign-1',
    color: null,
    createdBy: 'user-1',
    deletedBy: null,
    deletionTime: null,
    iconName: null,
    isActive: true,
    isBookmarked: false,
    isTrashed: false,
    location: RESOURCE_LOCATION.sidebar,
    myPermissionLevel: PERMISSION_LEVEL.FULL_ACCESS,
    name,
    parentId: null,
    previewAssetId: null,
    previewUrl: null,
    shares: [],
    slug: name.toLowerCase().replace(/\s+/gu, '-'),
    status: RESOURCE_STATUS.active,
    type,
    updatedBy: null,
    updatedTime: null,
  }
}

import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import type { CampaignId, SidebarItemId } from '../../../../../../shared/common/ids'
import { MAP_DROP_ZONE_TYPE } from '../../../drag-drop/drop-target-data'
import { executeRegisteredSurfaceDropCommand } from '../../../drag-drop/surface-command'
import { resolveSurfaceDropCommand } from '../../../drag-drop/surface-planner'
import type { MapItemWithContent } from '../../../game-maps/item-contract'
import {
  RESOURCE_LOCATION,
  RESOURCE_STATUS,
  RESOURCE_TYPES,
} from '../../../workspace/items-persistence-contract'
import type { AnyItem } from '../../../workspace/items'
import { useMapSidebarItemDropTarget } from '../use-map-sidebar-item-drop-target'

const toastMock = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: toastMock,
}))

describe('useMapSidebarItemDropTarget', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    toastMock.error.mockReset()
    toastMock.success.mockReset()
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
  })

  it('reports dropped pin placement failures with map-specific feedback', async () => {
    const map = createMap()
    const note = createNote()
    const createMapPins = vi.fn().mockRejectedValue(new Error('write failed'))
    const imageRef = {
      current: createImageWithRect({ left: 10, top: 20, width: 200, height: 100 }),
    }
    const { unmount } = renderHook(() =>
      useMapSidebarItemDropTarget({
        canPin: true,
        createMapPins,
        imageRef,
        map,
      }),
    )

    try {
      const command = resolveSurfaceDropCommand(
        [note],
        { type: MAP_DROP_ZONE_TYPE, mapId: map.id, mapName: map.name },
        { workspaceId: note.campaignId },
      )

      expect(command).toMatchObject({
        status: 'ready',
        action: 'pin',
        items: [note],
      })

      await act(async () => {
        await executeRegisteredSurfaceDropCommand({
          command,
          input: { clientX: 60, clientY: 45 },
          setBatchDecision: vi.fn(),
        })
      })

      expect(createMapPins).toHaveBeenCalledWith({
        mapId: map.id,
        pins: [{ itemId: note.id, layerId: null, x: 25, y: 25 }],
      })
      expect(toastMock.error).toHaveBeenCalledWith('Failed to place pin')
    } finally {
      unmount()
    }
  })

  it('reports when dropped sidebar items do not create map pins', async () => {
    const map = createMap()
    const note = createNote()
    const createMapPins = vi.fn().mockResolvedValue({
      status: 'completed',
      receipt: {
        affectedCount: 0,
        itemId: map.id,
        pinIds: [],
      },
    })
    const imageRef = {
      current: createImageWithRect({ left: 10, top: 20, width: 200, height: 100 }),
    }
    const { unmount } = renderHook(() =>
      useMapSidebarItemDropTarget({
        canPin: true,
        createMapPins,
        imageRef,
        map,
      }),
    )

    try {
      const command = resolveSurfaceDropCommand(
        [note],
        { type: MAP_DROP_ZONE_TYPE, mapId: map.id, mapName: map.name },
        { workspaceId: note.campaignId },
      )

      await act(async () => {
        await executeRegisteredSurfaceDropCommand({
          command,
          input: { clientX: 60, clientY: 45 },
          setBatchDecision: vi.fn(),
        })
      })

      expect(toastMock.error).toHaveBeenCalledWith('Pin was not placed')
    } finally {
      unmount()
    }
  })
})

function createMap(): MapItemWithContent {
  return {
    id: itemId('map-1'),
    name: 'Dungeon Map',
  } as MapItemWithContent
}

function createNote(): AnyItem {
  return {
    id: itemId('note-1'),
    campaignId: 'campaign-1' as CampaignId,
    location: RESOURCE_LOCATION.sidebar,
    status: RESOURCE_STATUS.active,
    type: RESOURCE_TYPES.notes,
    name: 'Pinned Note',
  } as AnyItem
}

function itemId(value: string): SidebarItemId {
  return value as SidebarItemId
}

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

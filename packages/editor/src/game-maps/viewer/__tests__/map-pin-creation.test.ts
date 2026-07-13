import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { toast } from 'sonner'
import type { MapPinId, SidebarItemId } from '../../../../../../shared/common/ids'
import { createMapPinsAtPosition } from '../map-pin-creation'

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}))

describe('createMapPinsAtPosition', () => {
  beforeEach(() => {
    vi.mocked(toast.error).mockClear()
    vi.mocked(toast.success).mockClear()
  })

  it('reports invalid completed receipts without rejecting the event path', async () => {
    const mapId = 'map-1' as SidebarItemId
    const createMapPins = vi.fn().mockResolvedValue({
      status: 'completed',
      receipt: {
        affectedCount: 2,
        itemId: mapId,
        pinIds: ['pin-1', 'pin-2'] as Array<MapPinId>,
      },
    })

    await expect(
      createMapPinsAtPosition({
        createMapPins,
        itemIds: ['note-1' as SidebarItemId],
        mapId,
        position: { x: 25, y: 75 },
      }),
    ).resolves.toBe(false)

    expect(toast.error).toHaveBeenCalledExactlyOnceWith('Failed to place pin')
    expect(toast.success).not.toHaveBeenCalled()
  })
})

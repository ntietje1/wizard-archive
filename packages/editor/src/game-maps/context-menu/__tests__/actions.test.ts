import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { toast } from 'sonner'
import type { MapPinId } from '../../../../../../shared/common/ids'
import { createMapPinActions } from '../actions'
import type { WorkspaceMapPinMenuService } from '../service'
import type { MapPinOperations } from '../../viewer/map-pin-operations'
import type { WorkspaceMenuContext } from '../../../workspace/menu-context'
import { VIEW_CONTEXT } from '../../../workspace/view-context'
import { completedResourceOperation } from '../../../filesystem/transaction-contract'
import type { ResourceOperationResult } from '../../../filesystem/transaction-contract'

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
  },
}))

describe('createMapPinActions', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.mocked(toast.error).mockClear()
    vi.mocked(toast.success).mockClear()
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
  })

  it('reports remove and visibility mutation outcomes', async () => {
    const removeMapPin = vi.fn().mockResolvedValue(
      completedResourceOperation({
        kind: 'mapPinRemoved',
        affectedCount: 1,
      }),
    )
    const updateMapPinVisibility = vi.fn().mockResolvedValue(
      completedResourceOperation({
        kind: 'mapPinVisibilityUpdated',
        affectedCount: 1,
      }),
    )
    const actions = createMapPinActions({
      mapPins: createMapPinMenuService({ removeMapPin, updateMapPinVisibility }),
    })

    await actions.removeMapPin(createContext())
    await actions.togglePinVisibility(createContext())

    expect(removeMapPin).toHaveBeenCalledExactlyOnceWith({ mapId: 'map-1', mapPinId: 'pin-1' })
    expect(updateMapPinVisibility).toHaveBeenCalledExactlyOnceWith({
      mapId: 'map-1',
      mapPinId: 'pin-1',
      isVisible: false,
    })
    expect(toast.success).toHaveBeenCalledWith('Pin removed')
    expect(toast.success).toHaveBeenCalledWith('Pin hidden')
  })

  it('reports remove and visibility mutation failures', async () => {
    const removeMapPin = vi.fn().mockRejectedValue(new Error('remove failed'))
    const updateMapPinVisibility = vi.fn().mockRejectedValue(new Error('visibility failed'))
    const actions = createMapPinActions({
      mapPins: createMapPinMenuService({ removeMapPin, updateMapPinVisibility }),
    })

    await actions.removeMapPin(createContext())
    await actions.togglePinVisibility(createContext())

    expect(toast.error).toHaveBeenCalledWith('Failed to remove pin')
    expect(toast.error).toHaveBeenCalledWith('Failed to toggle pin visibility')
    expect(consoleErrorSpy).toHaveBeenCalledTimes(2)
  })

  it.each(['error', 'unsupported', 'unavailable'] as const)(
    'reports resolved %s mutation failures without success feedback',
    async (status) => {
      const failure = operationFailure(status)
      const removeMapPin = vi.fn().mockResolvedValue(failure)
      const updateMapPinVisibility = vi.fn().mockResolvedValue(failure)
      const actions = createMapPinActions({
        mapPins: createMapPinMenuService({ removeMapPin, updateMapPinVisibility }),
      })

      await actions.removeMapPin(createContext())
      await actions.togglePinVisibility(createContext())

      expect(toast.error).toHaveBeenNthCalledWith(1, 'Failed to remove pin')
      expect(toast.error).toHaveBeenNthCalledWith(2, 'Failed to toggle pin visibility')
      expect(toast.success).not.toHaveBeenCalled()
      expect(consoleErrorSpy).toHaveBeenCalledTimes(2)
    },
  )

  it('does not run pin edit mutations when the active map cannot be edited', async () => {
    const removeMapPin = vi.fn()
    const updateMapPinVisibility = vi.fn()
    const requestPinMove = vi.fn()
    const actions = createMapPinActions({
      mapPins: createMapPinMenuService({
        canEditActiveMap: false,
        removeMapPin,
        requestPinMove,
        updateMapPinVisibility,
      }),
    })

    await actions.removeMapPin(createContext())
    await actions.togglePinVisibility(createContext())
    await actions.moveMapPin(createContext())

    expect(removeMapPin).not.toHaveBeenCalled()
    expect(updateMapPinVisibility).not.toHaveBeenCalled()
    expect(requestPinMove).not.toHaveBeenCalled()
  })
})

function createMapPinMenuService({
  canEditActiveMap = true,
  removeMapPin,
  requestPinMove = vi.fn(),
  updateMapPinVisibility,
}: {
  canEditActiveMap?: boolean
  removeMapPin: MapPinOperations['removeMapPin']
  requestPinMove?: WorkspaceMapPinMenuService['requestPinMove']
  updateMapPinVisibility: MapPinOperations['updateMapPinVisibility']
}): WorkspaceMapPinMenuService {
  return {
    getActiveMap: () => ({
      id: 'map-1' as never,
      pinnedItemIds: new Set(),
    }),
    getActivePin: () => ({
      id: 'pin-1' as MapPinId,
      item: null,
      visible: true,
    }),
    getPinOperations: () => ({
      removeMapPin,
      updateMapPinVisibility,
    }),
    requestPinPlacement: vi.fn(),
    requestPinMove,
    getUnpinnedMapItems: () => [],
    isActiveMapItem: () => false,
    isPinnedOnActiveMap: () => false,
    hasPinContext: () => true,
    canEditActiveMap: () => canEditActiveMap,
    getActivePinVisible: () => true,
  }
}

function createContext() {
  return {
    selectedItems: [],
    surface: VIEW_CONTEXT.MAP_VIEW,
  } satisfies WorkspaceMenuContext
}

function operationFailure(
  status: 'error' | 'unsupported' | 'unavailable',
): Exclude<ResourceOperationResult, { status: 'completed' }> {
  return status === 'error'
    ? { status, error: new Error('write failed') }
    : { status, reason: status }
}

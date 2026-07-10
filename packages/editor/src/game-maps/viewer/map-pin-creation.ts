import type { MaybePromise } from '../../../../../shared/common/async'
import type { SidebarItemId } from '../../../../../shared/common/ids'
import type { MapPinsCreateResult } from '../session-contract'
import { reportMapActionError } from './map-action-errors'
import { reportMapPinCreationResult } from './map-pin-creation-feedback'
import { buildMapPinPlacementInputs } from './map-pin-placement'
import type { PinPosition } from './map-pin-placement'

type CreateMapPins = (input: {
  mapId: SidebarItemId
  pins: Array<{ itemId: SidebarItemId; x: number; y: number }>
}) => MaybePromise<MapPinsCreateResult>

export async function createMapPinsAtPosition({
  createMapPins,
  itemIds,
  mapId,
  position,
}: {
  createMapPins: CreateMapPins
  itemIds: Array<SidebarItemId>
  mapId: SidebarItemId
  position: PinPosition
}) {
  try {
    const result = await createMapPins({
      mapId,
      pins: buildMapPinPlacementInputs(itemIds, position),
    })
    if (result.status === 'completed') {
      return reportMapPinCreationResult(result.receipt.pinIds, itemIds.length)
    }
    reportMapActionError(
      result,
      itemIds.length === 1 ? 'Failed to place pin' : 'Failed to place pins',
    )
    return false
  } catch (error) {
    reportMapActionError(
      error,
      itemIds.length === 1 ? 'Failed to place pin' : 'Failed to place pins',
    )
    return false
  }
}

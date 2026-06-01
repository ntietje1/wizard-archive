import { requireItemAccess } from '../../sidebarItems/validation/access'
import { getSidebarItem } from '../../sidebarItems/functions/getSidebarItem'
import { PERMISSION_LEVEL } from '../../../shared/permissions/types'
import { ERROR_CODE } from '../../../shared/errors/client'
import { throwClientError } from '../../errors'
import { validatePinDropTarget, validatePinTarget } from '../validation'
import { logEditHistory } from '../../editHistory/log'
import { EDIT_HISTORY_ACTION } from '../../editHistory/types'
import { SIDEBAR_ITEM_TYPES } from '../../../shared/sidebar-items/types'
import { captureGameMapSnapshot } from './captureGameMapSnapshot'
import type { CampaignMutationCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'

const MAX_ITEM_PINS_PER_REQUEST = 100
const MIN_PIN_COORDINATE = 0
const MAX_PIN_COORDINATE = 100

function assertPinCoordinate(value: number, axis: 'x' | 'y') {
  if (!Number.isFinite(value) || value < MIN_PIN_COORDINATE || value > MAX_PIN_COORDINATE) {
    throwClientError(
      ERROR_CODE.VALIDATION_FAILED,
      `Pin ${axis} coordinate must be between ${MIN_PIN_COORDINATE} and ${MAX_PIN_COORDINATE}`,
    )
  }
}

export async function createItemPins(
  ctx: CampaignMutationCtx,
  {
    mapId,
    pins,
  }: {
    mapId: Id<'sidebarItems'>
    pins: Array<{
      x: number
      y: number
      itemId: Id<'sidebarItems'>
    }>
  },
): Promise<Array<Id<'mapPins'>>> {
  const rawItem = await getSidebarItem(ctx, mapId)
  if (!rawItem) throwClientError(ERROR_CODE.NOT_FOUND, 'Map not found')
  await requireItemAccess(ctx, {
    rawItem,
    requiredLevel: PERMISSION_LEVEL.EDIT,
  })

  if (pins.length === 0) return []
  if (pins.length > MAX_ITEM_PINS_PER_REQUEST) {
    throwClientError(
      ERROR_CODE.VALIDATION_FAILED,
      `Cannot create more than ${MAX_ITEM_PINS_PER_REQUEST} pins at once`,
    )
  }
  for (const pin of pins) {
    assertPinCoordinate(pin.x, 'x')
    assertPinCoordinate(pin.y, 'y')
  }
  const requestedItemIds = new Set<Id<'sidebarItems'>>()
  for (const pin of pins) {
    if (requestedItemIds.has(pin.itemId)) {
      throwClientError(ERROR_CODE.VALIDATION_FAILED, 'Duplicate item id in pin request')
    }
    requestedItemIds.add(pin.itemId)
  }

  const items = (await Promise.all(pins.map((pin) => ctx.db.get('sidebarItems', pin.itemId)))).map(
    (item) => {
      if (!item) {
        throwClientError(ERROR_CODE.NOT_FOUND, 'Item not found')
      }
      if (item.campaignId !== rawItem.campaignId) {
        throwClientError(
          ERROR_CODE.VALIDATION_FAILED,
          'Item must belong to the same campaign as the map',
        )
      }
      return item
    },
  )

  const existingPins = await ctx.db
    .query('mapPins')
    .withIndex('by_map_item', (q) => q.eq('mapId', mapId))
    .collect()
  const existingPinItemIds = existingPins.map((p) => p.itemId)
  const nextPinItemIds = [...existingPinItemIds]

  for (const item of items) {
    const dropValidationError = validatePinDropTarget({
      mapId,
      item,
      existingPinItemIds: nextPinItemIds,
      campaignId: rawItem.campaignId,
    })
    if (dropValidationError === 'trashed_item') {
      throwClientError(ERROR_CODE.VALIDATION_FAILED, 'Restore the item before pinning it to a map')
    }
    const validationError = validatePinTarget(mapId, item._id, nextPinItemIds)
    if (validationError) {
      throwClientError(ERROR_CODE.VALIDATION_FAILED, validationError)
    }
    nextPinItemIds.push(item._id)
  }

  const userId = ctx.membership.userId

  const pinIds = await Promise.all(
    pins.map((pin) =>
      ctx.db.insert('mapPins', {
        mapId,
        itemId: pin.itemId,
        x: pin.x,
        y: pin.y,
        visible: false,
      }),
    ),
  )

  await ctx.db.patch('sidebarItems', mapId, {
    updatedTime: Date.now(),
    updatedBy: userId,
  })

  const editHistoryId = await logEditHistory(
    ctx,
    {
      itemId: mapId,
      itemType: SIDEBAR_ITEM_TYPES.gameMaps,
      action: EDIT_HISTORY_ACTION.map_pin_added,
      metadata: { pinItemName: items.length === 1 ? items[0].name : `${items.length} items` },
    },
    { hasSnapshot: false },
  )

  await captureGameMapSnapshot(ctx, {
    mapId,
    editHistoryId,
    campaignId: rawItem.campaignId,
  })
  await ctx.db.patch('editHistory', editHistoryId, { hasSnapshot: true })

  return pinIds
}

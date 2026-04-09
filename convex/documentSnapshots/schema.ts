import { defineTable } from 'convex/server'
import { v } from 'convex/values'
import {
  sidebarItemIdValidator,
  sidebarItemTypeValidator,
} from '../sidebarItems/schema/baseValidators'
import { commonTableFields, commonValidatorFields } from '../common/schema'
import { NOTE_SNAPSHOT_TYPE } from '../notes/types'
import { GAME_MAP_SNAPSHOT_TYPE } from '../gameMaps/types'

export const SNAPSHOT_TYPE = {
  yjs_state: NOTE_SNAPSHOT_TYPE,
  game_map: GAME_MAP_SNAPSHOT_TYPE,
} as const

export const snapshotTypeValidator = v.union(
  v.literal(SNAPSHOT_TYPE.yjs_state),
  v.literal(SNAPSHOT_TYPE.game_map),
)

const documentSnapshotTableFields = {
  itemId: sidebarItemIdValidator,
  itemType: sidebarItemTypeValidator,
  editHistoryId: v.id('editHistory'),
  campaignId: v.id('campaigns'),
  snapshotType: snapshotTypeValidator,
  data: v.bytes(),
  ...commonTableFields,
}

const documentSnapshotValidatorFields = {
  ...commonValidatorFields('documentSnapshots'),
  ...documentSnapshotTableFields,
}

export const documentSnapshotValidator = v.object(documentSnapshotValidatorFields)

export const documentSnapshotsTables = {
  documentSnapshots: defineTable({
    ...documentSnapshotTableFields,
  })
    .index('by_editHistory', ['editHistoryId'])
    .index('by_item', ['itemId'])
    .index('by_campaign', ['campaignId'])
    .index('by_item_and_type', ['itemId', 'itemType']),
}

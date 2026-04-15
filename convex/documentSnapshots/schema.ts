import { defineTable } from 'convex/server'
import { v } from 'convex/values'
import { sidebarItemTypeValidator } from '../sidebarItems/schema/validators'
import { convexValidatorFields } from '../common/schema'
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
  itemId: v.id('sidebarItems'),
  itemType: sidebarItemTypeValidator,
  editHistoryId: v.id('editHistory'),
  campaignId: v.id('campaigns'),
  snapshotType: snapshotTypeValidator,
  data: v.bytes(),
}

const documentSnapshotValidatorFields = {
  ...convexValidatorFields('documentSnapshots'),
  ...documentSnapshotTableFields,
}

export const documentSnapshotValidator = v.object(documentSnapshotValidatorFields)

export const documentSnapshotsTables = {
  documentSnapshots: defineTable({
    ...documentSnapshotTableFields,
  })
    .index('by_editHistory', ['editHistoryId'])
    .index('by_item', ['itemId']),
}

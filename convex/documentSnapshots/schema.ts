import { defineTable } from 'convex/server'
import { v } from 'convex/values'
import type { Validator } from 'convex/values'
import { RESOURCE_TYPES } from '@wizard-archive/editor/resources/items-persistence-contract'
import { DOCUMENT_SNAPSHOT_TYPE } from './types'
import type { SnapshotId } from '@wizard-archive/editor/resources/domain-id'

const snapshotIdValidator = v.string() as Validator<SnapshotId>

const documentSnapshotCommonFields = {
  snapshotUuid: snapshotIdValidator,
  itemId: v.id('sidebarItems'),
  editHistoryId: v.id('editHistory'),
  campaignId: v.id('campaigns'),
  data: v.bytes(),
}

const documentSnapshotVariants = [
  {
    ...documentSnapshotCommonFields,
    itemType: v.literal(RESOURCE_TYPES.notes),
    snapshotType: v.literal(DOCUMENT_SNAPSHOT_TYPE.YjsState),
  },
  {
    ...documentSnapshotCommonFields,
    itemType: v.literal(RESOURCE_TYPES.canvases),
    snapshotType: v.literal(DOCUMENT_SNAPSHOT_TYPE.YjsState),
  },
  {
    ...documentSnapshotCommonFields,
    itemType: v.literal(RESOURCE_TYPES.gameMaps),
    snapshotType: v.literal(DOCUMENT_SNAPSHOT_TYPE.GameMap),
  },
] as const

export const documentSnapshotsTables = {
  documentSnapshots: defineTable(
    v.union(...documentSnapshotVariants.map((fields) => v.object(fields))),
  )
    .index('by_snapshotUuid', ['snapshotUuid'])
    .index('by_campaign', ['campaignId'])
    .index('by_editHistory', ['editHistoryId'])
    .index('by_item', ['itemId']),
}

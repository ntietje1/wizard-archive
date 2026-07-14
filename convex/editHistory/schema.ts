import { defineTable } from 'convex/server'
import { v } from 'convex/values'
import type { Validator } from 'convex/values'
import { EDIT_HISTORY_ACTION } from '@wizard-archive/editor/resources/history-contract'
import { sidebarItemTypeValidator } from '../sidebarItems/schema/validators'
import { campaignIdValidator, campaignMemberIdValidator } from '../campaigns/schema'
import type { HistoryEntryId } from '@wizard-archive/editor/resources/domain-id'
import { resourceIdValidator } from '../resources/validators'

export const historyEntryIdValidator = v.string() as Validator<HistoryEntryId>

const editHistoryCommonFields = {
  historyEntryUuid: historyEntryIdValidator,
  itemId: v.id('sidebarItems'),
  itemType: sidebarItemTypeValidator,
  campaignId: v.id('campaigns'),
  campaignMemberId: v.id('campaignMembers'),
  hasSnapshot: v.boolean(),
}

const nullMetadataActions = [
  EDIT_HISTORY_ACTION.created,
  EDIT_HISTORY_ACTION.trashed,
  EDIT_HISTORY_ACTION.restored,
  EDIT_HISTORY_ACTION.content_edited,
  EDIT_HISTORY_ACTION.map_image_changed,
  EDIT_HISTORY_ACTION.map_image_removed,
  EDIT_HISTORY_ACTION.file_replaced,
  EDIT_HISTORY_ACTION.file_removed,
] as const

const copiedMetadataValidator = v.object({
  copiedFromItemId: resourceIdValidator,
  copiedFromName: v.string(),
})
const renamedMetadataValidator = v.object({ from: v.string(), to: v.string() })
const movedMetadataValidator = v.object({
  from: v.nullable(v.string()),
  to: v.nullable(v.string()),
})
const optionalStringChangeMetadataValidator = v.object({
  from: v.nullable(v.string()),
  to: v.nullable(v.string()),
})
const rolledBackMetadataValidator = v.object({
  restoredFromHistoryEntryId: historyEntryIdValidator,
})
const permissionChangedMetadataValidator = v.object({
  memberName: v.nullable(v.string()),
  level: v.nullable(v.string()),
  previousLevel: v.nullable(v.string()),
})
const blockShareChangedMetadataValidator = v.object({
  status: v.string(),
  memberId: v.optional(campaignMemberIdValidator),
  blockCount: v.optional(v.number()),
})
const inheritSharesChangedMetadataValidator = v.object({
  inheritShares: v.boolean(),
  previousInheritShares: v.boolean(),
})
const pinItemMetadataValidator = v.object({ pinItemName: v.string() })
const pinVisibilityMetadataValidator = v.object({
  pinItemName: v.string(),
  visible: v.boolean(),
})

const editHistoryChangeValidator = v.union(
  ...nullMetadataActions.map((action) =>
    v.object({ action: v.literal(action), metadata: v.null() }),
  ),
  v.object({ action: v.literal(EDIT_HISTORY_ACTION.copied), metadata: copiedMetadataValidator }),
  v.object({ action: v.literal(EDIT_HISTORY_ACTION.renamed), metadata: renamedMetadataValidator }),
  v.object({ action: v.literal(EDIT_HISTORY_ACTION.moved), metadata: movedMetadataValidator }),
  v.object({
    action: v.literal(EDIT_HISTORY_ACTION.icon_changed),
    metadata: optionalStringChangeMetadataValidator,
  }),
  v.object({
    action: v.literal(EDIT_HISTORY_ACTION.color_changed),
    metadata: optionalStringChangeMetadataValidator,
  }),
  v.object({
    action: v.literal(EDIT_HISTORY_ACTION.rolled_back),
    metadata: rolledBackMetadataValidator,
  }),
  v.object({
    action: v.literal(EDIT_HISTORY_ACTION.permission_changed),
    metadata: permissionChangedMetadataValidator,
  }),
  v.object({
    action: v.literal(EDIT_HISTORY_ACTION.block_share_changed),
    metadata: blockShareChangedMetadataValidator,
  }),
  v.object({
    action: v.literal(EDIT_HISTORY_ACTION.inherit_shares_changed),
    metadata: inheritSharesChangedMetadataValidator,
  }),
  v.object({
    action: v.literal(EDIT_HISTORY_ACTION.map_pin_added),
    metadata: pinItemMetadataValidator,
  }),
  v.object({
    action: v.literal(EDIT_HISTORY_ACTION.map_pin_moved),
    metadata: pinItemMetadataValidator,
  }),
  v.object({
    action: v.literal(EDIT_HISTORY_ACTION.map_pin_removed),
    metadata: pinItemMetadataValidator,
  }),
  v.object({
    action: v.literal(EDIT_HISTORY_ACTION.map_pin_visibility_changed),
    metadata: pinVisibilityMetadataValidator,
  }),
)

const editHistoryVariants = [
  ...nullMetadataActions.map((action) => ({
    ...editHistoryCommonFields,
    action: v.literal(action),
    metadata: v.null(),
  })),
  {
    ...editHistoryCommonFields,
    action: v.literal(EDIT_HISTORY_ACTION.copied),
    metadata: copiedMetadataValidator,
  },
  {
    ...editHistoryCommonFields,
    action: v.literal(EDIT_HISTORY_ACTION.renamed),
    metadata: renamedMetadataValidator,
  },
  {
    ...editHistoryCommonFields,
    action: v.literal(EDIT_HISTORY_ACTION.moved),
    metadata: movedMetadataValidator,
  },
  {
    ...editHistoryCommonFields,
    action: v.literal(EDIT_HISTORY_ACTION.icon_changed),
    metadata: optionalStringChangeMetadataValidator,
  },
  {
    ...editHistoryCommonFields,
    action: v.literal(EDIT_HISTORY_ACTION.color_changed),
    metadata: optionalStringChangeMetadataValidator,
  },
  {
    ...editHistoryCommonFields,
    action: v.literal(EDIT_HISTORY_ACTION.rolled_back),
    metadata: rolledBackMetadataValidator,
  },
  {
    ...editHistoryCommonFields,
    action: v.literal(EDIT_HISTORY_ACTION.updated),
    metadata: v.object({ changes: v.array(editHistoryChangeValidator) }),
  },
  {
    ...editHistoryCommonFields,
    action: v.literal(EDIT_HISTORY_ACTION.permission_changed),
    metadata: permissionChangedMetadataValidator,
  },
  {
    ...editHistoryCommonFields,
    action: v.literal(EDIT_HISTORY_ACTION.block_share_changed),
    metadata: blockShareChangedMetadataValidator,
  },
  {
    ...editHistoryCommonFields,
    action: v.literal(EDIT_HISTORY_ACTION.inherit_shares_changed),
    metadata: inheritSharesChangedMetadataValidator,
  },
  {
    ...editHistoryCommonFields,
    action: v.literal(EDIT_HISTORY_ACTION.map_pin_added),
    metadata: pinItemMetadataValidator,
  },
  {
    ...editHistoryCommonFields,
    action: v.literal(EDIT_HISTORY_ACTION.map_pin_moved),
    metadata: pinItemMetadataValidator,
  },
  {
    ...editHistoryCommonFields,
    action: v.literal(EDIT_HISTORY_ACTION.map_pin_removed),
    metadata: pinItemMetadataValidator,
  },
  {
    ...editHistoryCommonFields,
    action: v.literal(EDIT_HISTORY_ACTION.map_pin_visibility_changed),
    metadata: pinVisibilityMetadataValidator,
  },
] as const

export const editHistoryValidator = v.union(
  ...editHistoryVariants.map(
    ({
      historyEntryUuid: _historyEntryUuid,
      campaignId: _campaignRowId,
      campaignMemberId: _campaignMemberRowId,
      itemId: _itemRowId,
      ...fields
    }) =>
      v.object({
        id: historyEntryIdValidator,
        createdAt: v.number(),
        ...fields,
        itemId: resourceIdValidator,
        campaignId: campaignIdValidator,
        campaignMemberId: campaignMemberIdValidator,
      }),
  ),
)

export const editHistoryTables = {
  editHistory: defineTable(v.union(...editHistoryVariants.map((fields) => v.object(fields))))
    .index('by_historyEntryUuid', ['historyEntryUuid'])
    .index('by_campaign', ['campaignId'])
    .index('by_item', ['itemId'])
    .index('by_item_action', ['itemId', 'action']),
}

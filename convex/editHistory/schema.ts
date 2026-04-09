import { defineTable } from 'convex/server'
import { v } from 'convex/values'
import {
  sidebarItemIdValidator,
  sidebarItemTypeValidator,
} from '../sidebarItems/schema/baseValidators'
import { EDIT_HISTORY_ACTION } from './types'

const actions = Object.values(EDIT_HISTORY_ACTION).map((a) => v.literal(a))
if (actions.length === 0) {
  throw new Error('EDIT_HISTORY_ACTION must have at least one value to build validator')
}
const editHistoryActionValidator =
  actions.length === 1 ? actions[0] : v.union(actions[0], actions[1], ...actions.slice(2))

export const editHistoryTables = {
  editHistory: defineTable({
    itemId: sidebarItemIdValidator,
    itemType: sidebarItemTypeValidator,
    campaignId: v.id('campaigns'),
    campaignMemberId: v.id('campaignMembers'),
    action: editHistoryActionValidator,
    metadata: v.union(v.record(v.string(), v.any()), v.null()),
    hasSnapshot: v.boolean(),
  })
    .index('by_item', ['itemId'])
    .index('by_item_action', ['itemId', 'action'])
    .index('by_campaign', ['campaignId']),
}

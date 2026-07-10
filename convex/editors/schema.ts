import { defineTable } from 'convex/server'
import { v } from 'convex/values'
import { literals } from 'convex-helpers/validators'
import { convexValidatorFields } from '../common/schema'
import {
  SORT_DIRECTION_VALUES,
  SORT_ORDER_VALUES,
} from '@wizard-archive/editor/resources/items-persistence-contract'
import { WORKSPACE_MODE } from '../../shared/workspace/workspace-mode'

export const editorModeValidator = v.union(
  v.literal(WORKSPACE_MODE.VIEWER),
  v.literal(WORKSPACE_MODE.EDITOR),
)

const editorTableFields = {
  userId: v.id('userProfiles'),
  campaignId: v.id('campaigns'),
  sortOrder: literals(...SORT_ORDER_VALUES),
  sortDirection: literals(...SORT_DIRECTION_VALUES),
  editorMode: editorModeValidator,
}

export const editorTables = {
  editor: defineTable({
    ...editorTableFields,
  })
    .index('by_campaign_user', ['campaignId', 'userId'])
    .index('by_user', ['userId']),
}

const editorValidatorFields = {
  ...convexValidatorFields('editor'),
  ...editorTableFields,
}

export const editorValidator = v.object(editorValidatorFields)

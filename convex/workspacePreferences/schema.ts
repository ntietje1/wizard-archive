import { defineTable } from 'convex/server'
import { v } from 'convex/values'
import { literals } from 'convex-helpers/validators'
import { campaignIdValidator } from '../campaigns/schema'

export const workspaceSortValidator = v.object({
  by: literals('created', 'title', 'updated'),
  direction: literals('ascending', 'descending'),
})

export const workspacePreferencesValueValidator = v.object({
  mode: literals('editor', 'viewer'),
  sort: workspaceSortValidator,
  panels: v.object({
    leftVisible: v.boolean(),
    rightVisible: v.boolean(),
  }),
})

export const workspacePreferencePatchValidator = v.union(
  v.object({ field: v.literal('mode'), value: literals('editor', 'viewer') }),
  v.object({ field: v.literal('sort'), value: workspaceSortValidator }),
  v.object({ field: v.literal('leftPanelVisible'), value: v.boolean() }),
  v.object({ field: v.literal('rightPanelVisible'), value: v.boolean() }),
)

export const workspacePreferencesTables = {
  workspacePreferences: defineTable({
    campaignUuid: campaignIdValidator,
    userId: v.id('userProfiles'),
    value: workspacePreferencesValueValidator,
  })
    .index('by_campaign_user', ['campaignUuid', 'userId'])
    .index('by_user', ['userId']),
}

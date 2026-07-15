import { defineTable } from 'convex/server'
import { v } from 'convex/values'
import { literals } from 'convex-helpers/validators'
import { campaignIdValidator } from '../campaigns/schema'

export const workspaceSortValidator = v.object({
  by: literals('created', 'title', 'updated'),
  direction: literals('ascending', 'descending'),
})

export const workspacePanelPreferenceValidator = v.object({
  size: v.number(),
  visible: v.boolean(),
})

export const workspacePreferencesValueValidator = v.object({
  mode: literals('editor', 'viewer'),
  sort: workspaceSortValidator,
  panels: v.object({
    left: workspacePanelPreferenceValidator,
    right: workspacePanelPreferenceValidator,
  }),
})

export const workspacePreferencesSnapshotValidator = v.object({
  revision: v.number(),
  value: workspacePreferencesValueValidator,
})

export const workspacePreferenceChangeValidator = v.union(
  v.object({ type: v.literal('mode'), mode: literals('editor', 'viewer') }),
  v.object({ type: v.literal('sort'), sort: workspaceSortValidator }),
  v.object({
    type: v.literal('panel'),
    panel: literals('left', 'right'),
    size: v.optional(v.number()),
    visible: v.optional(v.boolean()),
  }),
)

export const workspacePreferencesTables = {
  workspacePreferences: defineTable({
    campaignUuid: campaignIdValidator,
    userId: v.id('userProfiles'),
    revision: v.number(),
    value: workspacePreferencesValueValidator,
  })
    .index('by_campaign_user', ['campaignUuid', 'userId'])
    .index('by_user', ['userId']),
}

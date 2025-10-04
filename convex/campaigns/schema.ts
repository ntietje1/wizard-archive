import { defineTable } from 'convex/server'
import { v } from 'convex/values'

export const campaignStatusValidator = v.union(
  v.literal('Active'),
  v.literal('Inactive'),
)

export const campaignMemberRoleValidator = v.union(
  v.literal('DM'),
  v.literal('Player'),
)

export const campaignMemberStatusValidator = v.union(
  v.literal('Pending'),
  v.literal('Accepted'),
  v.literal('Rejected'),
  v.literal('Removed'),
)

const campaignTableFields = {
  name: v.string(),
  description: v.optional(v.string()),
  updatedAt: v.number(),
  playerCount: v.number(),
  dmUserId: v.string(),
  slug: v.string(),
  status: campaignStatusValidator,
  currentSessionId: v.optional(v.id('sessions')),
}

const campaignMemberTableFields = {
  userId: v.string(),
  campaignId: v.id('campaigns'),
  role: campaignMemberRoleValidator,
  status: campaignMemberStatusValidator,
  updatedAt: v.number(),
}

export const campaignTables = {
  campaigns: defineTable({
    ...campaignTableFields,
  }).index('by_slug_dm', ['slug', 'dmUserId']),

  campaignMembers: defineTable({
    ...campaignMemberTableFields,
  })
    .index('by_campaign', ['campaignId'])
    .index('by_user', ['userId']),
}

const campaignValidatorFields = {
  _id: v.id('campaigns'),
  _creationTime: v.number(),
  ...campaignTableFields,
} as const

const campaignMemberValidatorFields = {
  _id: v.id('campaignMembers'),
  _creationTime: v.number(),
  ...campaignMemberTableFields,
} as const

export const campaignValidator = v.object(campaignValidatorFields)

export const campaignMemberValidator = v.object(campaignMemberValidatorFields)

import { defineTable } from 'convex/server'
import { v } from 'convex/values'
import { commonTableFields, commonValidatorFields } from '../common/schema'
import { userProfileValidator } from '../users/schema'

export const campaignStatusValidator = v.union(v.literal('Active'), v.literal('Inactive'))

export const campaignMemberRoleValidator = v.union(v.literal('DM'), v.literal('Player'))

export const campaignMemberStatusValidator = v.union(
  v.literal('Pending'),
  v.literal('Accepted'),
  v.literal('Rejected'),
  v.literal('Removed'),
)

const campaignTableFields = {
  name: v.string(),
  description: v.string(),
  dmUserId: v.id('userProfiles'),
  slug: v.string(),
  status: campaignStatusValidator,
  currentSessionId: v.union(v.id('sessions'), v.null()),
}

const campaignMemberTableFields = {
  userId: v.id('userProfiles'),
  campaignId: v.id('campaigns'),
  role: campaignMemberRoleValidator,
  status: campaignMemberStatusValidator,
}

export const campaignTables = {
  campaigns: defineTable({
    ...commonTableFields,
    ...campaignTableFields,
  }).index('by_slug_dm', ['slug', 'dmUserId']),

  campaignMembers: defineTable({
    ...commonTableFields,
    ...campaignMemberTableFields,
  })
    .index('by_campaign_user', ['campaignId', 'userId'])
    .index('by_user', ['userId']),
}

const campaignMemberValidatorFields = {
  ...commonValidatorFields('campaignMembers'),
  ...campaignMemberTableFields,
}

export const campaignMemberValidator = v.object({
  ...campaignMemberValidatorFields,
  userProfile: userProfileValidator,
})

const campaignValidatorFields = {
  ...commonValidatorFields('campaigns'),
  dmUserProfile: userProfileValidator,
  myMembership: v.union(campaignMemberValidator, v.null()),
  playerCount: v.number(),
  ...campaignTableFields,
}

export const campaignValidator = v.object(campaignValidatorFields)

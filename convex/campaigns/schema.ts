import { defineTable } from 'convex/server'
import { v } from 'convex/values'
import { literals } from 'convex-helpers/validators'
import { commonTableFields, commonValidatorFields } from '../common/schema'
import { userProfileValidator } from '../users/schema'

export const campaignStatusValidator = literals('Active', 'Inactive')

export const campaignMemberRoleValidator = literals('DM', 'Player')

export const campaignMemberStatusValidator = literals('Pending', 'Accepted', 'Rejected', 'Removed')

const campaignTableFields = {
  name: v.string(),
  description: v.string(),
  dmUserId: v.id('userProfiles'),
  slug: v.string(),
  status: campaignStatusValidator,
  currentSessionId: v.nullable(v.id('sessions')),
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
  myMembership: v.nullable(campaignMemberValidator),
  playerCount: v.number(),
  ...campaignTableFields,
}

export const campaignValidator = v.object(campaignValidatorFields)

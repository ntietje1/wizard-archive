import { defineTable } from 'convex/server'
import { v } from 'convex/values'
import { literals } from 'convex-helpers/validators'
import { domainValidatorFields } from '../common/schema'
import { userProfileSummaryValidator, userProfileValidator } from '../users/schema'

export const campaignStatusValidator = literals('Active', 'Inactive', 'Deleted')

export const campaignMemberRoleValidator = literals('DM', 'Player')

export const campaignMemberStatusValidator = literals('Pending', 'Accepted', 'Rejected', 'Removed')

const campaignTableFields = {
  name: v.string(),
  description: v.string(),
  dmUserId: v.id('userProfiles'),
  slug: v.string(),
  status: campaignStatusValidator,
  currentSessionId: v.nullable(v.id('sessions')),
  // Temporary widen-migrate-narrow shape; read paths normalize missing/null to false.
  defaultFolderInheritShares: v.optional(v.union(v.boolean(), v.null())),
}

const campaignMemberTableFields = {
  userId: v.id('userProfiles'),
  campaignId: v.id('campaigns'),
  role: campaignMemberRoleValidator,
  status: campaignMemberStatusValidator,
}

export const campaignTables = {
  campaigns: defineTable({
    ...campaignTableFields,
  }).index('by_slug_dm', ['slug', 'dmUserId']),

  campaignMembers: defineTable({
    ...campaignMemberTableFields,
  })
    .index('by_campaign_user', ['campaignId', 'userId'])
    .index('by_user', ['userId']),
}

const campaignMemberValidatorFields = {
  ...domainValidatorFields('campaignMembers'),
  ...campaignMemberTableFields,
}

export const campaignMemberValidator = v.object({
  ...campaignMemberValidatorFields,
  userProfile: userProfileValidator,
})

export const campaignMemberSummaryValidator = v.object({
  ...campaignMemberValidatorFields,
  userProfile: userProfileSummaryValidator,
})

const campaignValidatorFields = {
  ...domainValidatorFields('campaigns'),
  dmUserProfile: userProfileSummaryValidator,
  myMembership: v.nullable(campaignMemberSummaryValidator),
  acceptedMemberCount: v.number(),
  ...campaignTableFields,
}

export const campaignValidator = v.object(campaignValidatorFields)

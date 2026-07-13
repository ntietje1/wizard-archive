import { defineTable } from 'convex/server'
import { v } from 'convex/values'
import { literals } from 'convex-helpers/validators'
import { domainValidatorFields } from '../common/schema'
import { userProfileSummaryValidator, userProfileValidator } from '../users/schema'

export const campaignStatusValidator = literals('Active', 'Inactive', 'Deleted')

export const campaignMemberRoleValidator = literals('DM', 'Player')

export const campaignMemberStatusValidator = literals('Pending', 'Accepted', 'Rejected', 'Removed')

const campaignFields = {
  campaignUuid: v.string(),
  name: v.string(),
  description: v.string(),
  dmUserId: v.id('userProfiles'),
  slug: v.string(),
  status: campaignStatusValidator,
  // Temporary widen-migrate-narrow shape; read paths normalize missing/null to false.
  defaultFolderInheritShares: v.optional(v.union(v.boolean(), v.null())),
}

const campaignTableFields = {
  ...campaignFields,
  currentSessionId: v.nullable(v.id('sessions')),
}

const campaignMemberTableFields = {
  campaignMemberUuid: v.string(),
  userId: v.id('userProfiles'),
  campaignId: v.id('campaigns'),
  role: campaignMemberRoleValidator,
  status: campaignMemberStatusValidator,
}

export const campaignTables = {
  campaigns: defineTable({
    ...campaignTableFields,
  })
    .index('by_campaignUuid', ['campaignUuid'])
    .index('by_slug_dm', ['slug', 'dmUserId']),

  campaignMembers: defineTable({
    ...campaignMemberTableFields,
  })
    .index('by_campaignMemberUuid', ['campaignMemberUuid'])
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
  ...campaignFields,
  dmUserProfile: userProfileSummaryValidator,
  myMembership: v.nullable(campaignMemberSummaryValidator),
  acceptedMemberCount: v.number(),
}

export const campaignValidator = v.object(campaignValidatorFields)

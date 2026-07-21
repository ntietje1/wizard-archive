import { defineTable } from 'convex/server'
import { v } from 'convex/values'
import { literals } from 'convex-helpers/validators'
import {
  userProfileIdValidator,
  userProfileSummaryValidator,
  userProfileValidator,
} from '../users/schema'
import { FOLDER_ACCESS_INHERITANCE } from '@wizard-archive/editor/resources/access-policy'

export const campaignStatusValidator = literals('Active', 'Inactive', 'Deleted')

export const campaignMemberRoleValidator = literals('DM', 'Player')

export const campaignMemberStatusValidator = literals('Pending', 'Accepted', 'Rejected', 'Removed')

export const campaignIdValidator = v.string()
export const campaignMemberIdValidator = v.string()

const campaignFields = {
  campaignUuid: campaignIdValidator,
  assetsFolderUuid: v.optional(v.string()),
  name: v.string(),
  description: v.string(),
  dmUserId: v.id('userProfiles'),
  slug: v.string(),
  status: campaignStatusValidator,
  acceptedMemberCount: v.number(),
  resourceAccessDefaults: v.object({
    folderInheritance: v.union(
      v.literal(FOLDER_ACCESS_INHERITANCE.disabled),
      v.literal(FOLDER_ACCESS_INHERITANCE.enabled),
    ),
  }),
}

const campaignTableFields = {
  ...campaignFields,
  currentSessionId: v.nullable(v.id('sessions')),
}

const campaignMemberTableFields = {
  campaignMemberUuid: campaignMemberIdValidator,
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
    .index('by_campaign_status_role_member', ['campaignId', 'status', 'role', 'campaignMemberUuid'])
    .index('by_user', ['userId'])
    .index('by_user_status', ['userId', 'status']),
}

const publicCampaignMemberFields = {
  id: campaignMemberIdValidator,
  campaignId: campaignIdValidator,
  userId: userProfileIdValidator,
  createdAt: v.number(),
  role: campaignMemberRoleValidator,
  status: campaignMemberStatusValidator,
}

export const campaignMemberValidator = v.object({
  ...publicCampaignMemberFields,
  userProfile: userProfileValidator,
})

export const campaignMemberSummaryValidator = v.object({
  ...publicCampaignMemberFields,
  userProfile: userProfileSummaryValidator,
})

const publicCampaignFields = {
  id: campaignIdValidator,
  createdAt: v.number(),
  name: v.string(),
  description: v.string(),
  slug: v.string(),
  status: campaignStatusValidator,
  resourceAccessDefaults: v.object({
    folderInheritance: v.union(
      v.literal(FOLDER_ACCESS_INHERITANCE.disabled),
      v.literal(FOLDER_ACCESS_INHERITANCE.enabled),
    ),
  }),
  dmUserProfile: userProfileSummaryValidator,
  myMembership: v.nullable(campaignMemberSummaryValidator),
  acceptedMemberCount: v.number(),
}

export const campaignValidator = v.object(publicCampaignFields)

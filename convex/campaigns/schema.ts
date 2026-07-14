import { defineTable } from 'convex/server'
import { v } from 'convex/values'
import type { Validator } from 'convex/values'
import { literals } from 'convex-helpers/validators'
import {
  userProfileIdValidator,
  userProfileSummaryValidator,
  userProfileValidator,
} from '../users/schema'
import type { CampaignId, CampaignMemberId } from '@wizard-archive/editor/resources/domain-id'

export const campaignStatusValidator = literals('Active', 'Inactive', 'Deleted')

export const campaignMemberRoleValidator = literals('DM', 'Player')

export const campaignMemberStatusValidator = literals('Pending', 'Accepted', 'Rejected', 'Removed')

export const campaignIdValidator = v.string() as Validator<CampaignId>
export const campaignMemberIdValidator = v.string() as Validator<CampaignMemberId>

const campaignFields = {
  campaignUuid: campaignIdValidator,
  name: v.string(),
  description: v.string(),
  dmUserId: v.id('userProfiles'),
  slug: v.string(),
  status: campaignStatusValidator,
  defaultFolderInheritShares: v.boolean(),
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
    .index('by_user', ['userId']),
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
  defaultFolderInheritShares: v.boolean(),
  dmUserProfile: userProfileSummaryValidator,
  myMembership: v.nullable(campaignMemberSummaryValidator),
  acceptedMemberCount: v.number(),
}

export const campaignValidator = v.object(publicCampaignFields)

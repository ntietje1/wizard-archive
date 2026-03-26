import type { Id } from '../_generated/dataModel'
import type { CommonValidatorFields } from '../common/types'
import type { UserProfile } from '../users/types'

export const CAMPAIGN_STATUS = {
  Active: 'Active',
  Inactive: 'Inactive',
} as const

export type CampaignStatus =
  (typeof CAMPAIGN_STATUS)[keyof typeof CAMPAIGN_STATUS]

export const CAMPAIGN_MEMBER_ROLE = {
  DM: 'DM',
  Player: 'Player',
} as const

export type CampaignMemberRole =
  (typeof CAMPAIGN_MEMBER_ROLE)[keyof typeof CAMPAIGN_MEMBER_ROLE]

export const CAMPAIGN_MEMBER_STATUS = {
  Accepted: 'Accepted',
  Pending: 'Pending',
  Rejected: 'Rejected',
  Removed: 'Removed',
} as const

export type CampaignMemberStatus =
  (typeof CAMPAIGN_MEMBER_STATUS)[keyof typeof CAMPAIGN_MEMBER_STATUS]

export type CampaignFromDb = CommonValidatorFields<'campaigns'> & {
  dmUserId: Id<'userProfiles'>
  name: string
  description: string
  slug: string
  status: CampaignStatus
  currentSessionId: Id<'sessions'> | null
}

export type Campaign = CampaignFromDb & {
  dmUserProfile: UserProfile
  myMembership: CampaignMember | null
  playerCount: number
}

export type CampaignMemberFromDb = CommonValidatorFields<'campaignMembers'> & {
  userId: Id<'userProfiles'>
  campaignId: Id<'campaigns'>
  role: CampaignMemberRole
  status: CampaignMemberStatus
}

export type CampaignMember = CampaignMemberFromDb & {
  userProfile: UserProfile
}

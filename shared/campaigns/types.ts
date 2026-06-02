import type { CampaignId, CampaignMemberId, SessionId, UserProfileId } from '../common/ids'
import type { CampaignSlug } from './validation'
import type { UserProfile } from '../users/types'

export const CAMPAIGN_STATUS = {
  Active: 'Active',
  Inactive: 'Inactive',
  Deleted: 'Deleted',
} as const

type CampaignStatus = (typeof CAMPAIGN_STATUS)[keyof typeof CAMPAIGN_STATUS]

export const CAMPAIGN_MEMBER_ROLE = {
  DM: 'DM',
  Player: 'Player',
} as const

export type CampaignMemberRole = (typeof CAMPAIGN_MEMBER_ROLE)[keyof typeof CAMPAIGN_MEMBER_ROLE]

export const CAMPAIGN_MEMBER_STATUS = {
  Accepted: 'Accepted',
  Pending: 'Pending',
  Rejected: 'Rejected',
  Removed: 'Removed',
} as const

export type CampaignMemberStatus =
  (typeof CAMPAIGN_MEMBER_STATUS)[keyof typeof CAMPAIGN_MEMBER_STATUS]

export type CampaignFromDb = {
  _id: CampaignId
  _creationTime: number
  dmUserId: UserProfileId
  name: string
  description: string
  slug: CampaignSlug
  status: CampaignStatus
  currentSessionId: SessionId | null
}

export type Campaign = CampaignFromDb & {
  dmUserProfile: UserProfile
  myMembership: CampaignMember | null
  playerCount: number
}

export type CampaignMemberFromDb = {
  _id: CampaignMemberId
  _creationTime: number
  userId: UserProfileId
  campaignId: CampaignId
  role: CampaignMemberRole
  status: CampaignMemberStatus
}

export type CampaignMember = CampaignMemberFromDb & {
  userProfile: UserProfile
}

import type { CampaignId, CampaignMemberId, SessionId, UserProfileId } from '../common/ids'
import type { CampaignSlug } from './validation'
import type { UserProfile, UserProfileSummary } from '../users/types'

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

export type CampaignRow = {
  _id: CampaignId
  _creationTime: number
  dmUserId: UserProfileId
  name: string
  description: string
  slug: CampaignSlug
  status: CampaignStatus
  currentSessionId: SessionId | null
  defaultFolderInheritShares: boolean
}

export type Campaign = Omit<CampaignRow, '_id' | '_creationTime'> & {
  id: CampaignId
  createdAt: number
  dmUserProfile: UserProfileSummary
  myMembership: CampaignMemberSummary | null
  acceptedMemberCount: number
}

export type CampaignMemberRow = {
  _id: CampaignMemberId
  _creationTime: number
  userId: UserProfileId
  campaignId: CampaignId
  role: CampaignMemberRole
  status: CampaignMemberStatus
}

export type CampaignMember = Omit<CampaignMemberRow, '_id' | '_creationTime'> & {
  id: CampaignMemberId
  createdAt: number
  userProfile: UserProfile
}

export type CampaignMemberSummary = Omit<CampaignMemberRow, '_id' | '_creationTime'> & {
  id: CampaignMemberId
  createdAt: number
  userProfile: UserProfileSummary
}

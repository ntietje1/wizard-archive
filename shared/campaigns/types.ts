import type {
  CampaignId,
  CampaignMemberId,
  UserProfileId,
} from '@wizard-archive/editor/resources/domain-id'
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

type CampaignMemberRole = (typeof CAMPAIGN_MEMBER_ROLE)[keyof typeof CAMPAIGN_MEMBER_ROLE]

export const CAMPAIGN_MEMBER_STATUS = {
  Accepted: 'Accepted',
  Pending: 'Pending',
  Rejected: 'Rejected',
  Removed: 'Removed',
} as const

export type CampaignMemberStatus =
  (typeof CAMPAIGN_MEMBER_STATUS)[keyof typeof CAMPAIGN_MEMBER_STATUS]

export type Campaign = {
  id: CampaignId
  createdAt: number
  name: string
  description: string
  slug: CampaignSlug
  status: CampaignStatus
  defaultFolderInheritShares: boolean
  dmUserProfile: UserProfileSummary
  myMembership: CampaignMemberSummary | null
  acceptedMemberCount: number
}

type PublicCampaignMember = {
  id: CampaignMemberId
  createdAt: number
  userId: UserProfileId
  campaignId: CampaignId
  role: CampaignMemberRole
  status: CampaignMemberStatus
}

export type CampaignMember = PublicCampaignMember & {
  userProfile: UserProfile
}

export type CampaignMemberSummary = PublicCampaignMember & {
  userProfile: UserProfileSummary
}

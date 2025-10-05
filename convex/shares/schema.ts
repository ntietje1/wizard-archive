import { defineTable } from 'convex/server'
import { v } from 'convex/values'
import { tagValidatorFields } from '../tags/schema'
import { tagBackedEntityFields } from '../tags/schema'
import { campaignMemberValidator } from '../campaigns/schema'

const shareTableFields = {
  ...tagBackedEntityFields,
  memberId: v.optional(v.id('campaignMembers')),
}

export const shareTables = {
  shares: defineTable({
    ...shareTableFields,
  })
    .index('by_campaign_tag', ['campaignId', 'tagId'])
    .index('by_campaign_member', ['campaignId', 'memberId']),
}

const shareValidatorFields = {
  ...tagValidatorFields,
  ...shareTableFields,
} as const

export const shareValidator = v.object({
  ...shareValidatorFields,
  shareId: v.id('shares'), // additional field to be explicit about which field is the id
  member: v.optional(campaignMemberValidator),
})

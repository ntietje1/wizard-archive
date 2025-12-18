import { defineTable } from 'convex/server'
import { v } from 'convex/values'
import { tagValidatorFields, tagBackedEntityFields } from '../tags/schema'

const sessionTableFields = {
  ...tagBackedEntityFields,
  endedAt: v.optional(v.number()),
}

export const sessionTables = {
  sessions: defineTable({
    ...sessionTableFields,
  }).index('by_campaign_tag_endedAt', ['campaignId', 'tagId', 'endedAt']),
}

const sessionValidatorFields = {
  ...tagValidatorFields,
  ...sessionTableFields,
} as const

export const sessionValidator = v.object({
  ...sessionValidatorFields,
  sessionId: v.id('sessions'), // additional field to be explicit about which field is the id
})

import { defineTable } from 'convex/server'
import { v } from 'convex/values'
import { tagValidatorFields } from '../tags/schema'

const sessionTableFields = {
  campaignId: v.id('campaigns'),
  tagId: v.id('tags'),
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

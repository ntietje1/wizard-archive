import { defineTable } from 'convex/server'
import { v } from 'convex/values'

const sessionTableFields = {
  campaignId: v.id('campaigns'),
  name: v.optional(v.string()),
  startedAt: v.number(),
  endedAt: v.optional(v.number()),
  updatedAt: v.number(),
}

export const sessionTables = {
  sessions: defineTable({
    ...sessionTableFields,
  })
    .index('by_campaign_startedAt', ['campaignId', 'startedAt'])
    .index('by_campaign_endedAt', ['campaignId', 'endedAt']),
}

const sessionValidatorFields = {
  _id: v.id('sessions'),
  _creationTime: v.number(),
  ...sessionTableFields,
} as const

export const sessionValidator = v.object(sessionValidatorFields)

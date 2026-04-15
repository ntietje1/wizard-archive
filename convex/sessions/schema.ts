import { defineTable } from 'convex/server'
import { v } from 'convex/values'
import { convexValidatorFields } from '../common/schema'

const sessionTableFields = {
  campaignId: v.id('campaigns'),
  name: v.nullable(v.string()),
  startedAt: v.number(),
  endedAt: v.nullable(v.number()),
}

export const sessionTables = {
  sessions: defineTable({
    ...sessionTableFields,
  }).index('by_campaign_startedAt', ['campaignId', 'startedAt']),
}

const sessionValidatorFields = {
  ...convexValidatorFields('sessions'),
  ...sessionTableFields,
}

export const sessionValidator = v.object(sessionValidatorFields)

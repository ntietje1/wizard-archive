import { defineTable } from 'convex/server'
import { v } from 'convex/values'
import { commonTableFields, commonValidatorFields } from '../common/schema'

const sessionTableFields = {
  campaignId: v.id('campaigns'),
  name: v.union(v.string(), v.null()),
  startedAt: v.number(),
  endedAt: v.union(v.number(), v.null()),
}

export const sessionTables = {
  sessions: defineTable({
    ...commonTableFields,
    ...sessionTableFields,
  })
    .index('by_campaign_startedAt', ['campaignId', 'startedAt'])
    .index('by_campaign_endedAt', ['campaignId', 'endedAt']),
}

const sessionValidatorFields = {
  ...commonValidatorFields('sessions'),
  ...sessionTableFields,
}

export const sessionValidator = v.object(sessionValidatorFields)

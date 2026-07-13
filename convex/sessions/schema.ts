import { defineTable } from 'convex/server'
import { v } from 'convex/values'
import type { Validator } from 'convex/values'
import type { SessionId } from '@wizard-archive/editor/resources/domain-id'

export const sessionIdValidator = v.string() as Validator<SessionId>

const sessionTableFields = {
  sessionUuid: sessionIdValidator,
  campaignId: v.id('campaigns'),
  name: v.nullable(v.string()),
  startedAt: v.number(),
  endedAt: v.nullable(v.number()),
}

export const sessionTables = {
  sessions: defineTable({
    ...sessionTableFields,
  })
    .index('by_sessionUuid', ['sessionUuid'])
    .index('by_campaign_startedAt', ['campaignId', 'startedAt']),
}

export const sessionValidator = v.object({
  id: sessionIdValidator,
  createdAt: v.number(),
  campaignId: v.id('campaigns'),
  name: v.nullable(v.string()),
  startedAt: v.number(),
  endedAt: v.nullable(v.number()),
})

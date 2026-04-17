import { defineTable } from 'convex/server'
import { v } from 'convex/values'
import { literals } from 'convex-helpers/validators'
import { convexValidatorFields } from '../common/schema'

const linkSyntaxValidator = literals('wiki', 'md')

const noteLinkTableFields = {
  sourceNoteId: v.id('sidebarItems'),
  targetItemId: v.union(v.id('sidebarItems'), v.null()),
  query: v.string(),
  displayName: v.union(v.string(), v.null()),
  syntax: linkSyntaxValidator,
  campaignId: v.id('campaigns'),
  blockId: v.id('blocks'),
}

export const noteLinksTables = {
  noteLinks: defineTable({
    ...noteLinkTableFields,
  })
    .index('by_campaign_block_target', ['campaignId', 'blockId', 'targetItemId'])
    .index('by_campaign_block_query', ['campaignId', 'blockId', 'query'])
    .index('by_campaign_source', ['campaignId', 'sourceNoteId'])
    .index('by_campaign_target', ['campaignId', 'targetItemId']),
}

const noteLinkValidatorFields = {
  ...convexValidatorFields('noteLinks'),
  ...noteLinkTableFields,
}

export const noteLinkValidator = v.object(noteLinkValidatorFields)

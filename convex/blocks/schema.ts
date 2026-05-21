import { defineTable } from 'convex/server'
import { v } from 'convex/values'
import { literals } from 'convex-helpers/validators'
import { convexValidatorFields } from '../common/schema'
import { BLOCK_TYPES } from '../../shared/blockTypes'
import { blockContentValidator, inlineContentArrayValidator } from './inlineContentValidators'

export const blockNoteIdValidator = v.string()

export const blockShareStatusValidator = literals('all_shared', 'not_shared', 'individually_shared')

export const blockTypeValidator = literals(...BLOCK_TYPES)

const blockPropsValidator = v.record(v.string(), v.union(v.string(), v.number(), v.boolean()))

const blockTableFields = {
  noteId: v.id('sidebarItems'),
  blockNoteId: blockNoteIdValidator,
  position: v.nullable(v.number()),
  parentBlockId: v.nullable(blockNoteIdValidator),
  depth: v.number(),
  type: blockTypeValidator,
  props: blockPropsValidator,
  content: v.optional(v.nullable(blockContentValidator)),
  inlineContent: v.nullable(inlineContentArrayValidator),
  plainText: v.string(),
  campaignId: v.id('campaigns'),
  shareStatus: v.nullable(blockShareStatusValidator),
}

export const blocksTables = {
  blocks: defineTable({
    ...blockTableFields,
  })
    .index('by_campaign_note_block', ['campaignId', 'noteId', 'blockNoteId'])
    .index('by_campaign_note_type', ['campaignId', 'noteId', 'type'])
    .searchIndex('search_plainText', {
      searchField: 'plainText',
      filterFields: ['campaignId', 'noteId', 'type'],
    }),
}

const blockValidatorFields = {
  ...convexValidatorFields('blocks'),
  ...blockTableFields,
}

export const blockValidator = v.object(blockValidatorFields)

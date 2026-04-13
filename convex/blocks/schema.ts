import { defineTable } from 'convex/server'
import { v } from 'convex/values'
import { zodToConvex } from 'convex-helpers/server/zod4'
import { literals } from 'convex-helpers/validators'
import {
  blockNoteIdSchema,
  blockTypeSchema,
  blockInlineContentSchema,
  blockPropsSchema,
} from './blockSchemas'
import { commonTableFields, commonValidatorFields } from '../common/schema'

export const blockNoteIdValidator = zodToConvex(blockNoteIdSchema)

export const blockShareStatusValidator = literals('all_shared', 'not_shared', 'individually_shared')

const blockTableFields = {
  noteId: v.id('sidebarItems'),
  blockNoteId: zodToConvex(blockNoteIdSchema),
  position: v.nullable(v.number()),
  parentBlockId: v.nullable(zodToConvex(blockNoteIdSchema)),
  depth: v.number(),
  type: zodToConvex(blockTypeSchema),
  props: zodToConvex(blockPropsSchema),
  inlineContent: zodToConvex(blockInlineContentSchema),
  plainText: v.nullable(v.string()),
  campaignId: v.id('campaigns'),
  shareStatus: v.nullable(blockShareStatusValidator),
  ...commonTableFields,
}

export const blocksTables = {
  blocks: defineTable({
    ...blockTableFields,
  })
    .index('by_campaign_note', ['campaignId', 'noteId'])
    .index('by_campaign_note_block', ['campaignId', 'noteId', 'blockNoteId']),
}

const blockValidatorFields = {
  ...commonValidatorFields('blocks'),
  ...blockTableFields,
}

export const blockValidator = v.object(blockValidatorFields)

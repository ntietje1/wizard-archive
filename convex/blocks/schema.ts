import { z } from 'zod'
import { defineTable } from 'convex/server'
import { v } from 'convex/values'
import type { Validator } from 'convex/values'
import { zodToConvex } from 'convex-helpers/server/zod4'
import { literals } from 'convex-helpers/validators'
import { commonTableFields, commonValidatorFields } from '../common/schema'
import { blockNoteBlockValidator } from './blockNoteValidator'
import { blockTypeSchema, inlineContentSchema, tableContentSchema } from './sharedBlockSchemas'
import type { CustomBlock } from '../notes/editorSpecs'

// Cast so API args/returns using customBlockValidator infer as CustomBlock.
// The runtime validator (blockNoteBlockValidator) validates strictly.
export const customBlockValidator = blockNoteBlockValidator as unknown as Validator<
  CustomBlock,
  'required'
>

export const blockNoteIdValidator = v.string()

export const blockShareStatusValidator = literals('all_shared', 'not_shared', 'individually_shared')

const blockTableFields = {
  noteId: v.id('sidebarItems'),
  blockId: v.string(),
  position: v.nullable(v.number()),
  parentBlockId: v.nullable(v.string()),
  depth: v.number(),
  type: zodToConvex(blockTypeSchema),
  props: v.record(v.string(), v.union(v.string(), v.number(), v.boolean())),
  inlineContent: v.nullable(
    v.union(zodToConvex(z.array(inlineContentSchema)), zodToConvex(tableContentSchema)),
  ),
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
    .index('by_campaign_note_block', ['campaignId', 'noteId', 'blockId']),
}

const blockValidatorFields = {
  ...commonValidatorFields('blocks'),
  ...blockTableFields,
}

export const blockValidator = v.object(blockValidatorFields)

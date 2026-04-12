import { defineTable } from 'convex/server'
import { v } from 'convex/values'
import type { Validator } from 'convex/values'
import { literals } from 'convex-helpers/validators'
import { commonTableFields, commonValidatorFields } from '../common/schema'
import { blockNoteBlockValidator } from './blockNoteValidator'
import type { CustomBlock } from '../notes/editorSpecs'

export const blockNoteIdValidator = v.string()

// Cast so Doc<'blocks'>['content'] infers as CustomBlock throughout the codebase.
// The runtime validator (blockNoteBlockValidator) is unchanged and validates strictly.
export const customBlockValidator = blockNoteBlockValidator as unknown as Validator<
  CustomBlock,
  'required'
>

export const blockShareStatusValidator = literals('all_shared', 'not_shared', 'individually_shared')

const blockTableFields = {
  noteId: v.id('sidebarItems'),
  blockId: v.string(),
  position: v.nullable(v.number()),
  content: customBlockValidator,
  isTopLevel: v.boolean(),
  campaignId: v.id('campaigns'),
  shareStatus: v.nullable(blockShareStatusValidator),
  ...commonTableFields,
}

export const blocksTables = {
  blocks: defineTable({
    ...blockTableFields,
  })
    .index('by_campaign_note_block', ['campaignId', 'noteId', 'blockId'])
    .index('by_campaign_note_topLevel', ['campaignId', 'noteId', 'isTopLevel'])
    .index('by_campaign_note_shareStatus', ['campaignId', 'noteId', 'shareStatus']),
}

const blockValidatorFields = {
  ...commonValidatorFields('blocks'),
  ...blockTableFields,
}

export const blockValidator = v.object(blockValidatorFields)

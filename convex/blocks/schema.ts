import { z } from 'zod'
import { defineTable } from 'convex/server'
import { v } from 'convex/values'
import { zodToConvex } from 'convex-helpers/server/zod4'
import { literals } from 'convex-helpers/validators'
import type { Validator } from 'convex/values'
import type { CustomBlock } from '../notes/editorSpecs'
import {
  blockNoteIdSchema,
  blockNoteBlockSchema,
  blockTypeSchema,
  inlineContentSchema,
  tableContentSchema,
} from './blockSchemas'
import { commonTableFields, commonValidatorFields } from '../common/schema'

// --- Convex validators (all zodToConvex conversions live here) ---

export const blockNoteIdValidator = zodToConvex(blockNoteIdSchema)

export const blockShareStatusValidator = literals('all_shared', 'not_shared', 'individually_shared')

// Compile-time check: blockNoteBlockSchema output shares the structural keys with CustomBlock.
// Full mutual assignability isn't possible because CustomBlock carries BlockNote-specific
// generic parameters, but the runtime validator (zodToConvex) validates strictly via Zod.
type _BlockSchemaOutput = z.infer<typeof blockNoteBlockSchema>
type _AssertKeysPresent = _BlockSchemaOutput extends {
  id: string
  type: string
  props: Record<string, unknown>
  children?: Array<unknown>
}
  ? true
  : never
const _keyCheck: _AssertKeysPresent = true as _AssertKeysPresent

export const customBlockValidator = zodToConvex(blockNoteBlockSchema) as unknown as Validator<
  CustomBlock,
  'required'
>

// --- Table definition ---

const blockInlineContentSchema = z.nullable(
  z.union([z.array(inlineContentSchema), tableContentSchema]),
)
const blockPropsSchema = z.record(z.string(), z.union([z.string(), z.number(), z.boolean()]))

const blockTableFields = {
  noteId: v.id('sidebarItems'),
  blockNoteId: zodToConvex(blockNoteIdSchema),
  position: v.nullable(v.number()),
  parentBlockId: v.nullable(zodToConvex(blockNoteIdSchema)),
  depth: v.number(),
  type: zodToConvex(blockTypeSchema),
  props: zodToConvex(blockPropsSchema),
  inlineContent: zodToConvex(blockInlineContentSchema),
  plainText: v.string(),
  campaignId: v.id('campaigns'),
  shareStatus: v.nullable(blockShareStatusValidator),
  ...commonTableFields,
}

export const blocksTables = {
  blocks: defineTable({
    ...blockTableFields,
  })
    .index('by_campaign_note', ['campaignId', 'noteId'])
    .index('by_campaign_note_block', ['campaignId', 'noteId', 'blockNoteId'])
    .searchIndex('search_plainText', {
      searchField: 'plainText',
      filterFields: ['campaignId', 'noteId', 'type', 'deletionTime'],
    }),
}

const blockValidatorFields = {
  ...commonValidatorFields('blocks'),
  ...blockTableFields,
}

export const blockValidator = v.object(blockValidatorFields)

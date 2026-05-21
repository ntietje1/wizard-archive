import type { z } from 'zod'
import type { WithoutSystemFields } from 'convex/server'
import type { Doc, Id } from '../_generated/dataModel'
import type { ShareStatus } from '../blockShares/types'
import type {
  blockNoteBlockSchema,
  blockNoteIdSchema,
  blockTypeSchema,
  flatBlockContentSchema,
  inlineContentSchema,
  partialBlockNoteBlockSchema,
  tableCellSchema,
  tableContentSchema,
} from './blockSchemas'

export type FlatBlockContent = z.infer<typeof flatBlockContentSchema>
export type BlockType = z.infer<typeof blockTypeSchema>
export type BlockNoteId = z.infer<typeof blockNoteIdSchema>
export type BlockProps = FlatBlockContent['props']
export type InlineContentItem = z.infer<typeof inlineContentSchema>
export type InlineContent = Array<InlineContentItem>
export type CustomInlineContent = InlineContentItem
export type TableCell = z.infer<typeof tableCellSchema>
export type TableContent = z.infer<typeof tableContentSchema>
export type CustomBlock = z.infer<typeof blockNoteBlockSchema>
export type CustomPartialBlock = z.infer<typeof partialBlockNoteBlockSchema>

export type BlockShareInfo = {
  blockNoteId: BlockNoteId
  shareStatus: ShareStatus
  sharedMemberIds: Array<Id<'campaignMembers'>>
}

export type HeadingLevel = Extract<FlatBlockContent, { type: 'heading' }>['props']['level']

export type Heading = {
  blockNoteId: BlockNoteId
  text: string
  level: HeadingLevel
  normalizedText: string
}

type PersistedBlockCommon = {
  blockNoteId: BlockNoteId
  position: number | null
  parentBlockId: BlockNoteId | null
  depth: number
  plainText: string
}

type InlineBlockType = Exclude<BlockType, 'table'>

type PersistedInlineBlock = {
  [Type in InlineBlockType]: {
    type: Type
    props: Extract<FlatBlockContent, { type: Type }>['props']
    content?: InlineContent | null
    inlineContent: InlineContent | null
  }
}[InlineBlockType]

type PersistedTableBlock = {
  type: 'table'
  props: Extract<FlatBlockContent, { type: 'table' }>['props']
  content?: TableContent | null
  inlineContent: null
}

export type PersistedFlatBlock = PersistedBlockCommon & (PersistedInlineBlock | PersistedTableBlock)

export type BlockInsert = WithoutSystemFields<Doc<'blocks'>>

export type Block = Doc<'blocks'>

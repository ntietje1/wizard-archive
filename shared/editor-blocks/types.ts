import type { z } from 'zod'
import type { ShareStatus } from './share-status'
import type {
  blockNoteBlockSchema,
  blockNoteIdSchema,
  blockTypeSchema,
  flatBlockContentSchema,
  inlineContentSchema,
  partialBlockNoteBlockSchema,
  tableContentSchema,
} from './blockSchemas'

export type FlatBlockContent = z.infer<typeof flatBlockContentSchema>
export type BlockType = z.infer<typeof blockTypeSchema>
export type BlockNoteId = z.infer<typeof blockNoteIdSchema>
type InlineContentItem = z.infer<typeof inlineContentSchema>
export type InlineContent = Array<InlineContentItem>
export type TableContent = z.infer<typeof tableContentSchema>
export type CustomBlock = z.infer<typeof blockNoteBlockSchema>
export type CustomPartialBlock = z.infer<typeof partialBlockNoteBlockSchema>

export type BlockShareInfo<MemberId extends string> = {
  blockNoteId: BlockNoteId
  shareStatus: ShareStatus
  sharedMemberIds: Array<MemberId>
}

export type HeadingLevel = Extract<FlatBlockContent, { type: 'heading' }>['props']['level']

export type Heading = {
  blockNoteId: BlockNoteId
  text: string
  level: HeadingLevel
  normalizedText: string
}

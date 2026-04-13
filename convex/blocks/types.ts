import type { z } from 'zod'
import type { ShareStatus } from '../blockShares/types'
import type { Id } from '../_generated/dataModel'
import type {
  blockNoteIdSchema,
  blockTypeSchema,
  flatBlockContentSchema,
  inlineContentSchema,
  tableContentSchema,
} from './blockSchemas'
import type { CommonValidatorFields } from '../common/types'

export type FlatBlockContent = z.infer<typeof flatBlockContentSchema>

export type BlockType = z.infer<typeof blockTypeSchema>

export type BlockNoteId = z.infer<typeof blockNoteIdSchema>

export type BlockProps = FlatBlockContent['props']

export type InlineContent =
  | Array<z.infer<typeof inlineContentSchema>>
  | z.infer<typeof tableContentSchema>

export type BlockShareInfo = {
  blockNoteId: BlockNoteId
  shareStatus: ShareStatus
  sharedMemberIds: Array<Id<'campaignMembers'>>
}

export type Block = CommonValidatorFields<'blocks'> & {
  noteId: Id<'sidebarItems'>
  blockNoteId: BlockNoteId
  position: number | null
  parentBlockId: BlockNoteId | null
  depth: number
  type: BlockType
  props: BlockProps
  inlineContent: InlineContent | null
  plainText: string | null
  campaignId: Id<'campaigns'>
  shareStatus: ShareStatus | null
}

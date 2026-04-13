import type { z } from 'zod'
import type { ShareStatus } from '../blockShares/types'
import type { Id, Doc } from '../_generated/dataModel'
import type {
  blockNoteIdSchema,
  blockTypeSchema,
  inlineContentSchema,
  tableContentSchema,
} from './blockSchemas'

export type BlockType = z.infer<typeof blockTypeSchema>

export type BlockNoteId = z.infer<typeof blockNoteIdSchema>

export type BlockProps = Record<string, string | number | boolean>

export type InlineContent =
  | Array<z.infer<typeof inlineContentSchema>>
  | z.infer<typeof tableContentSchema>

export type BlockShareInfo = {
  blockNoteId: BlockNoteId
  shareStatus: ShareStatus
  sharedMemberIds: Array<Id<'campaignMembers'>>
}

export type Block = Doc<'blocks'>

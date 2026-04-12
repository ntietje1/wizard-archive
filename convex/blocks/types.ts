import type { z } from 'zod'
import type { ShareStatus } from '../blockShares/types'
import type { Id, Doc } from '../_generated/dataModel'
import type { blockTypeSchema, inlineContentSchema, tableContentSchema } from './sharedBlockSchemas'

export type BlockType = z.infer<typeof blockTypeSchema>

export type BlockProps = Record<string, string | number | boolean>

export type InlineContent =
  | Array<z.infer<typeof inlineContentSchema>>
  | z.infer<typeof tableContentSchema>

export type BlockShareInfo = {
  blockNoteId: string
  shareStatus: ShareStatus
  sharedMemberIds: Array<Id<'campaignMembers'>>
}

export type Block = Doc<'blocks'>

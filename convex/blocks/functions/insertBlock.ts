import { ERROR_CODE, throwClientError } from '../../errors'
import type { ShareStatus } from '../../blockShares/types'
import type { Id } from '../../_generated/dataModel'
import type { CampaignMutationCtx } from '../../functions'
import type { BlockNoteId, BlockProps, BlockType, InlineContent } from '../types'

export async function insertBlock(
  ctx: CampaignMutationCtx,
  params: {
    noteId: Id<'sidebarItems'>
    campaignId: Id<'campaigns'>
    blockNoteId: BlockNoteId
    parentBlockId: BlockNoteId | null
    depth: number
    position: number | null
    type: BlockType
    props: BlockProps
    inlineContent: InlineContent | null
    plainText: string | null
    shareStatus: ShareStatus
  },
): Promise<Id<'blocks'>> {
  if (params.depth < 0) throwClientError(ERROR_CODE.VALIDATION_FAILED, 'depth must be non-negative')
  if (params.parentBlockId === null && params.depth !== 0)
    throwClientError(ERROR_CODE.VALIDATION_FAILED, 'depth must be 0 when parentBlockId is null')
  if (params.parentBlockId !== null && params.depth === 0)
    throwClientError(ERROR_CODE.VALIDATION_FAILED, 'depth must be > 0 when parentBlockId is set')

  return await ctx.db.insert('blocks', {
    noteId: params.noteId,
    campaignId: params.campaignId,
    blockNoteId: params.blockNoteId,
    parentBlockId: params.parentBlockId,
    depth: params.depth,
    position: params.position,
    type: params.type,
    props: params.props,
    inlineContent: params.inlineContent,
    plainText: params.plainText,
    shareStatus: params.shareStatus,
    deletionTime: null,
    deletedBy: null,
    updatedTime: null,
    updatedBy: null,
    createdBy: ctx.membership.userId,
  })
}

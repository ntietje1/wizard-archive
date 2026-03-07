import { requireItemAccess } from '../../sidebarItems/validation'
import { PERMISSION_LEVEL } from '../../permissions/types'
import { requireDmRole } from '../../functions'
import { setBlockShareStatusHelper } from './blockShareMutations'
import type { AuthMutationCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'
import type { ShareStatus } from '../types'

export const setBlocksShareStatus = async (
  ctx: AuthMutationCtx,
  {
    noteId,
    blocks,
    status,
  }: {
    noteId: Id<'notes'>
    blocks: Array<{ blockNoteId: string; content: any }>
    status: ShareStatus
  },
): Promise<null> => {
  const note = await ctx.db.get(noteId)
  const item = await requireItemAccess(ctx, {
    rawItem: note,
    requiredLevel: PERMISSION_LEVEL.FULL_ACCESS,
  })

  const campaignId = item.campaignId
  await requireDmRole(ctx, campaignId)

  await Promise.all(
    blocks.map((blockItem) =>
      setBlockShareStatusHelper(ctx, {
        noteId,
        blockItem,
        status,
      }),
    ),
  )

  return null
}

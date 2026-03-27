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
  const rawNote = await ctx.db.get(noteId)
  const note = await requireItemAccess(ctx, {
    rawItem: rawNote,
    requiredLevel: PERMISSION_LEVEL.FULL_ACCESS,
  })

  await requireDmRole(ctx, note.campaignId)

  await Promise.all(
    blocks.map((blockItem) =>
      setBlockShareStatusHelper(ctx, {
        note,
        blockItem,
        status,
      }),
    ),
  )

  return null
}

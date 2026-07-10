import type { Id } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'

type PreviewLeaseReader = Pick<QueryCtx, 'db'>
type PreviewLeaseWriter = Pick<MutationCtx, 'db'>

export async function getPreviewLease(ctx: PreviewLeaseReader, sidebarItemId: Id<'sidebarItems'>) {
  return await ctx.db
    .query('sidebarItemPreviewLeases')
    .withIndex('by_sidebarItemId', (q) => q.eq('sidebarItemId', sidebarItemId))
    .unique()
}

export async function replacePreviewLease(
  ctx: PreviewLeaseWriter,
  {
    sidebarItemId,
    claimToken,
    lockedUntil,
  }: {
    sidebarItemId: Id<'sidebarItems'>
    claimToken: string
    lockedUntil: number
  },
) {
  const currentLease = await getPreviewLease(ctx, sidebarItemId)
  if (currentLease) {
    await ctx.db.patch('sidebarItemPreviewLeases', currentLease._id, { claimToken, lockedUntil })
    return
  }
  await ctx.db.insert('sidebarItemPreviewLeases', { sidebarItemId, claimToken, lockedUntil })
}

export async function deletePreviewLease(
  ctx: PreviewLeaseWriter,
  sidebarItemId: Id<'sidebarItems'>,
) {
  const lease = await getPreviewLease(ctx, sidebarItemId)
  if (lease) await ctx.db.delete('sidebarItemPreviewLeases', lease._id)
}

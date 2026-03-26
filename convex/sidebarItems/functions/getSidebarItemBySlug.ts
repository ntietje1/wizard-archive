import { requireCampaignMembership } from '../../functions'
import { getSidebarItemById } from './getSidebarItemById'
import type { AnySidebarItemWithContent } from '../types/types'
import type { AuthQueryCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'

export const getSidebarItemBySlug = async (
  ctx: AuthQueryCtx,
  { slug, campaignId }: { slug: string; campaignId: Id<'campaigns'> },
): Promise<AnySidebarItemWithContent | null> => {
  await requireCampaignMembership(ctx, campaignId)

  const queryTable = (table: 'notes' | 'folders' | 'gameMaps' | 'files') =>
    ctx.db
      .query(table)
      .withIndex('by_campaign_slug', (q) =>
        q.eq('campaignId', campaignId).eq('slug', slug),
      )
      .filter((q) => q.eq(q.field('deletionTime'), null))
      .unique()

  const [note, folder, map, file] = await Promise.all([
    queryTable('notes'),
    queryTable('folders'),
    queryTable('gameMaps'),
    queryTable('files'),
  ])

  const item = note ?? folder ?? map ?? file
  if (!item) return null

  return await getSidebarItemById(ctx, { id: item._id })
}

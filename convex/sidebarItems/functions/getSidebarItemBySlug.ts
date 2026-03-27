import { requireCampaignMembership } from '../../functions'
import { PERMISSION_LEVEL } from '../../permissions/types'
import { checkItemAccess } from '../validation'
import { enhanceNoteWithContent } from '../../notes/functions/enhanceNote'
import { enhanceFolderWithContent } from '../../folders/functions/enhanceFolder'
import { enhanceGameMapWithContent } from '../../gameMaps/functions/enhanceMap'
import { enhanceFileWithContent } from '../../files/functions/enhanceFile'
import type { AnySidebarItemWithContent } from '../types/types'
import type { AuthQueryCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'

export const getSidebarItemBySlug = async (
  ctx: AuthQueryCtx,
  { slug, campaignId }: { slug: string; campaignId: Id<'campaigns'> },
): Promise<AnySidebarItemWithContent | null> => {
  await requireCampaignMembership(ctx, campaignId)

  const idx = (q: any) => q.eq('campaignId', campaignId).eq('slug', slug)

  // specifically don't filter out deleted items, as they are still viewable in this context
  const [note, folder, map, file] = await Promise.all([
    ctx.db.query('notes').withIndex('by_campaign_slug', idx).unique(),
    ctx.db.query('folders').withIndex('by_campaign_slug', idx).unique(),
    ctx.db.query('gameMaps').withIndex('by_campaign_slug', idx).unique(),
    ctx.db.query('files').withIndex('by_campaign_slug', idx).unique(),
  ])

  if (note) {
    const enhanced = await checkItemAccess(ctx, {
      rawItem: note,
      requiredLevel: PERMISSION_LEVEL.VIEW,
    })
    return enhanced ? enhanceNoteWithContent(ctx, { note: enhanced }) : null
  }
  if (folder) {
    const enhanced = await checkItemAccess(ctx, {
      rawItem: folder,
      requiredLevel: PERMISSION_LEVEL.VIEW,
    })
    return enhanced ? enhanceFolderWithContent(ctx, { folder: enhanced }) : null
  }
  if (map) {
    const enhanced = await checkItemAccess(ctx, {
      rawItem: map,
      requiredLevel: PERMISSION_LEVEL.VIEW,
    })
    return enhanced
      ? enhanceGameMapWithContent(ctx, { gameMap: enhanced })
      : null
  }
  if (file) {
    const enhanced = await checkItemAccess(ctx, {
      rawItem: file,
      requiredLevel: PERMISSION_LEVEL.VIEW,
    })
    return enhanced ? enhanceFileWithContent(ctx, { file: enhanced }) : null
  }

  return null
}

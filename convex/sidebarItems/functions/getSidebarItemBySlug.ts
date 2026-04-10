import { requireCampaignMembership } from '../../functions'
import { PERMISSION_LEVEL } from '../../permissions/types'
import { SIDEBAR_ITEM_TYPES } from '../types/baseTypes'
import { checkItemAccess } from '../validation'
import { enhanceNoteWithContent } from '../../notes/functions/enhanceNote'
import { enhanceFolderWithContent } from '../../folders/functions/enhanceFolder'
import { enhanceGameMapWithContent } from '../../gameMaps/functions/enhanceMap'
import { enhanceFileWithContent } from '../../files/functions/enhanceFile'
import { enhanceCanvasWithContent } from '../../canvases/functions/enhanceCanvas'
import { loadSingleExtensionData } from './loadExtensionData'
import { assertNever } from '../../common/types'
import type { AnySidebarItemWithContent } from '../types/types'
import type { AuthQueryCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'

export const getSidebarItemBySlug = async (
  ctx: AuthQueryCtx,
  { slug, campaignId }: { slug: string; campaignId: Id<'campaigns'> },
): Promise<AnySidebarItemWithContent | null> => {
  await requireCampaignMembership(ctx, campaignId)

  const raw = await ctx.db
    .query('sidebarItems')
    .withIndex('by_campaign_slug', (q) => q.eq('campaignId', campaignId).eq('slug', slug))
    .unique()

  if (!raw) return null

  const item = await loadSingleExtensionData(ctx, raw)

  const enhanced = await checkItemAccess(ctx, {
    rawItem: item,
    requiredLevel: PERMISSION_LEVEL.VIEW,
  })
  if (!enhanced) return null

  switch (enhanced.type) {
    case SIDEBAR_ITEM_TYPES.notes:
      return enhanceNoteWithContent(ctx, { note: enhanced })
    case SIDEBAR_ITEM_TYPES.folders:
      return enhanceFolderWithContent(ctx, { folder: enhanced })
    case SIDEBAR_ITEM_TYPES.gameMaps:
      return enhanceGameMapWithContent(ctx, { gameMap: enhanced })
    case SIDEBAR_ITEM_TYPES.files:
      return enhanceFileWithContent(ctx, { file: enhanced })
    case SIDEBAR_ITEM_TYPES.canvases:
      return enhanceCanvasWithContent(ctx, { canvas: enhanced })
    default:
      return assertNever(enhanced)
  }
}

import { checkItemAccess } from '../../sidebarItems/validation'
import { loadSingleExtensionData } from '../../sidebarItems/functions/loadExtensionData'
import { PERMISSION_LEVEL } from '../../permissions/types'
import { requireCampaignMembership } from '../../functions'
import { enhanceFolderWithContent } from './enhanceFolder'
import type { AuthQueryCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'
import type { FolderFromDb, FolderWithContent } from '../types'

export const getFolder = async (
  ctx: AuthQueryCtx,
  { folderId }: { folderId: Id<'sidebarItems'> },
): Promise<FolderWithContent | null> => {
  const rawItem = await ctx.db.get('sidebarItems', folderId)
  if (!rawItem) return null
  await requireCampaignMembership(ctx, rawItem.campaignId)
  const rawFolder = (await loadSingleExtensionData(ctx, rawItem)) as FolderFromDb
  const folder = await checkItemAccess(ctx, {
    rawItem: rawFolder,
    requiredLevel: PERMISSION_LEVEL.VIEW,
  })
  if (!folder) return null
  return enhanceFolderWithContent(ctx, { folder })
}

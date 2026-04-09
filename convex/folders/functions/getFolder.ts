import { checkItemAccess } from '../../sidebarItems/validation'
import { PERMISSION_LEVEL } from '../../permissions/types'
import { requireCampaignMembership } from '../../functions'
import { enhanceFolderWithContent } from './enhanceFolder'
import type { AuthQueryCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'
import type { FolderWithContent } from '../types'

export const getFolder = async (
  ctx: AuthQueryCtx,
  { folderId }: { folderId: Id<'folders'> },
): Promise<FolderWithContent | null> => {
  const rawFolder = await ctx.db.get("folders", folderId)
  if (!rawFolder) return null
  await requireCampaignMembership(ctx, rawFolder.campaignId)
  const folder = await checkItemAccess(ctx, {
    rawItem: rawFolder,
    requiredLevel: PERMISSION_LEVEL.VIEW,
  })
  if (!folder) return null
  return enhanceFolderWithContent(ctx, { folder })
}

import { checkItemAccess } from '../../sidebarItems/validation'
import { PERMISSION_LEVEL } from '../../permissions/types'
import { enhanceFolderWithContent } from './enhanceFolder'
import type { CampaignQueryCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'
import type { FolderWithContent } from '../types'

export const getFolder = async (
  ctx: CampaignQueryCtx,
  { folderId }: { folderId: Id<'folders'> },
): Promise<FolderWithContent | null> => {
  const rawFolder = await ctx.db.get(folderId)
  const folder = await checkItemAccess(ctx, {
    rawItem: rawFolder,
    requiredLevel: PERMISSION_LEVEL.VIEW,
  })
  if (!folder) return null
  return enhanceFolderWithContent(ctx, { folder })
}

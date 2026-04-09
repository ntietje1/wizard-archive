import { checkItemAccess } from '../../sidebarItems/validation'
import { PERMISSION_LEVEL } from '../../permissions/types'
import { requireCampaignMembership } from '../../functions'
import { enhanceFileWithContent } from './enhanceFile'
import type { AuthQueryCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'
import type { FileWithContent } from '../types'

export const getFile = async (
  ctx: AuthQueryCtx,
  { fileId }: { fileId: Id<'files'> },
): Promise<FileWithContent | null> => {
  const rawFile = await ctx.db.get("files", fileId)
  if (!rawFile) return null
  await requireCampaignMembership(ctx, rawFile.campaignId)
  const file = await checkItemAccess(ctx, {
    rawItem: rawFile,
    requiredLevel: PERMISSION_LEVEL.VIEW,
  })
  if (!file) return null
  return enhanceFileWithContent(ctx, { file })
}

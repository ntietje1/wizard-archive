import { checkItemAccess } from '../../sidebarItems/validation'
import { loadSingleExtensionData } from '../../sidebarItems/functions/loadExtensionData'
import { PERMISSION_LEVEL } from '../../permissions/types'
import { requireCampaignMembership } from '../../functions'
import { enhanceFileWithContent } from './enhanceFile'
import type { AuthQueryCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'
import type { FileFromDb, FileWithContent } from '../types'

export const getFile = async (
  ctx: AuthQueryCtx,
  { fileId }: { fileId: Id<'sidebarItems'> },
): Promise<FileWithContent | null> => {
  const rawItem = await ctx.db.get('sidebarItems', fileId)
  if (!rawItem) return null
  await requireCampaignMembership(ctx, rawItem.campaignId)
  const rawFile = (await loadSingleExtensionData(ctx, rawItem)) as FileFromDb
  const file = await checkItemAccess(ctx, {
    rawItem: rawFile,
    requiredLevel: PERMISSION_LEVEL.VIEW,
  })
  if (!file) return null
  return enhanceFileWithContent(ctx, { file })
}

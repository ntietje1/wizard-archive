import { enhanceSidebarItem } from '../sidebarItems/helpers'
import { hasViewPermission } from '../shares/itemShares'
import { enhanceFileWithContent } from './helpers'
import type { CampaignQueryCtx } from '../functions'
import type { Id } from '../_generated/dataModel'
import type { FileWithContent } from './types'

export const getFile = async (
  ctx: CampaignQueryCtx,
  fileId: Id<'files'>,
): Promise<FileWithContent | null> => {
  const rawFile = await ctx.db.get(fileId)
  if (!rawFile) return null

  const file = await enhanceSidebarItem(ctx, rawFile)
  const hasPermission = await hasViewPermission(ctx, file)
  if (!hasPermission) return null
  return enhanceFileWithContent(ctx, file)
}

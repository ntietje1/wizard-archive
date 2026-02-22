import { checkItemAccess } from '../sidebarItems/validation'
import { PERMISSION_LEVEL } from '../shares/types'
import { enhanceFileWithContent } from './helpers'
import type { CampaignQueryCtx } from '../functions'
import type { Id } from '../_generated/dataModel'
import type { FileWithContent } from './types'

export const getFile = async (
  ctx: CampaignQueryCtx,
  fileId: Id<'files'>,
): Promise<FileWithContent | null> => {
  const rawFile = await ctx.db.get(fileId)
  const file = await checkItemAccess(ctx, rawFile, PERMISSION_LEVEL.VIEW)
  if (!file) return null
  return enhanceFileWithContent(ctx, file)
}

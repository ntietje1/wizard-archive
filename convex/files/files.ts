import { enhanceSidebarItem } from '../sidebarItems/helpers'
import {
  enforceSidebarItemSharePermissionsOrNull,
  requireEditPermission,
} from '../shares/itemShares'
import { enhanceFileWithContent } from './helpers'
import type { Id } from '../_generated/dataModel'
import type { Ctx } from '../common/types'
import type { MutationCtx } from '../_generated/server'
import type { FileWithContent } from './types'

export const getFile = async (
  ctx: Ctx,
  fileId: Id<'files'>,
): Promise<FileWithContent | null> => {
  const rawFile = await ctx.db.get(fileId)
  if (!rawFile) return null

  const file = await enhanceSidebarItem(ctx, rawFile)
  const permitted = await enforceSidebarItemSharePermissionsOrNull(ctx, file)
  if (!permitted) return null

  return enhanceFileWithContent(ctx, permitted)
}

export const deleteFile = async (
  ctx: MutationCtx,
  fileId: Id<'files'>,
): Promise<Id<'files'>> => {
  const rawFile = await ctx.db.get(fileId)
  if (!rawFile) {
    throw new Error('File not found')
  }

  const file = await enhanceSidebarItem(ctx, rawFile)
  await requireEditPermission(ctx, file)

  await ctx.db.delete(fileId)
  return fileId
}

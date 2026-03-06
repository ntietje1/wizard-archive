import { saveTopLevelBlocksForNote } from '../../blocks/functions/saveTopLevelBlocksForNote'
import {
  findNewSidebarItemSlug,
  validateSidebarCreateParent,
  validateSidebarItemName,
} from '../../sidebarItems/validation'
import { SIDEBAR_ITEM_TYPES } from '../../sidebarItems/types/baseTypes'
import { EMPTY_PM_DOC, prosemirrorSync } from '../../prosemirrorSync'
import type { AuthMutationCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'
import type { CustomBlock } from '../editorSpecs'

export async function createNote(
  ctx: AuthMutationCtx,
  {
    name,
    parentId,
    iconName,
    color,
    content,
    campaignId,
  }: {
    name: string
    parentId: Id<'folders'> | null
    iconName?: string
    color?: string
    content?: Array<CustomBlock>
    campaignId: Id<'campaigns'>
  },
): Promise<{ noteId: Id<'notes'>; slug: string }> {
  name = name.trim()

  await validateSidebarCreateParent(ctx, { parentId, campaignId })
  await validateSidebarItemName(ctx, {
    parentId,
    name,
    campaignId,
  })

  const uniqueSlug = await findNewSidebarItemSlug(ctx, {
    type: SIDEBAR_ITEM_TYPES.notes,
    name,
    campaignId,
  })

  const now = Date.now()
  const profileId = ctx.user.profile._id

  const noteId = await ctx.db.insert('notes', {
    name,
    slug: uniqueSlug,
    parentId,
    iconName: iconName ?? null,
    color: color ?? null,
    allPermissionLevel: null,
    campaignId,
    type: SIDEBAR_ITEM_TYPES.notes,
    updatedTime: now,
    updatedBy: profileId,
    createdBy: profileId,
  })

  if (content) {
    await saveTopLevelBlocksForNote(ctx, { noteId, content })
  }
  await prosemirrorSync.create(ctx, noteId, EMPTY_PM_DOC)
  return { noteId, slug: uniqueSlug }
}

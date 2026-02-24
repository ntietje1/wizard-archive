import { saveTopLevelBlocksForNote } from '../../blocks/blocks'
import {
  findNewSidebarItemSlug,
  validateSidebarCreateParent,
  validateSidebarItemName,
} from '../../sidebarItems/validation'
import { SIDEBAR_ITEM_TYPES } from '../../sidebarItems/types/baseTypes'
import { EMPTY_PM_DOC, prosemirrorSync } from '../../prosemirrorSync'
import type { CampaignMutationCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'
import type { CustomBlock } from '../editorSpecs'

export async function createNote(
  ctx: CampaignMutationCtx,
  {
    name,
    parentId,
    iconName,
    color,
    content,
  }: {
    name?: string
    parentId?: Id<'folders'>
    iconName?: string
    color?: string
    content?: Array<CustomBlock>
  },
): Promise<{ noteId: Id<'notes'>; slug: string }> {
  const campaignId = ctx.campaign._id

  await validateSidebarCreateParent(ctx, { parentId })
  await validateSidebarItemName(ctx, { parentId, name })

  const uniqueSlug = await findNewSidebarItemSlug(ctx, {
    type: SIDEBAR_ITEM_TYPES.notes,
    name,
  })

  const now = Date.now()
  const profileId = ctx.user.profile._id

  const noteId = await ctx.db.insert('notes', {
    name,
    slug: uniqueSlug,
    parentId,
    iconName,
    color,
    campaignId,
    type: SIDEBAR_ITEM_TYPES.notes,
    _updatedTime: now,
    _updatedBy: profileId,
    _createdBy: profileId,
  })

  if (content) {
    await saveTopLevelBlocksForNote(ctx, { noteId, content })
  }
  await prosemirrorSync.create(ctx, noteId, EMPTY_PM_DOC)
  return { noteId, slug: uniqueSlug }
}

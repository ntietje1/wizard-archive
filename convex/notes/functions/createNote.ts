import { saveTopLevelBlocksForNote } from '../../blocks/functions/saveTopLevelBlocksForNote'
import {
  findUniqueSidebarItemSlug,
  validateSidebarCreateParent,
  validateSidebarItemName,
} from '../../sidebarItems/validation'
import {
  SIDEBAR_ITEM_LOCATION,
  SIDEBAR_ITEM_TYPES,
} from '../../sidebarItems/types/baseTypes'
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

  await validateSidebarCreateParent(ctx, { campaignId, parentId })
  await validateSidebarItemName(ctx, {
    campaignId,
    parentId,
    name,
  })

  const uniqueSlug = await findUniqueSidebarItemSlug(ctx, {
    name,
    campaignId,
  })

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
    location: SIDEBAR_ITEM_LOCATION.sidebar,
    deletionTime: null,
    deletedBy: null,
    updatedTime: null,
    updatedBy: null,
    createdBy: profileId,
  })

  if (content) {
    await saveTopLevelBlocksForNote(ctx, { noteId, content })
  }
  await prosemirrorSync.create(ctx, noteId, EMPTY_PM_DOC)
  return { noteId, slug: uniqueSlug }
}

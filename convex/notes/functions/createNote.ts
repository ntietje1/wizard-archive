import * as Y from 'yjs'
import { saveAllBlocksForNote } from '../../blocks/functions/saveAllBlocksForNote'
import { syncNoteLinks } from '../../links/functions/syncNoteLinks'
import type { ParsedCreateParentTarget } from '../../sidebarItems/validation/parent'
import { prepareSidebarItemCreate } from '../../sidebarItems/validation/orchestration'
import { resolveOrCreateFolderPath } from '../../folders/functions/resolveOrCreateFolderPath'
import { SIDEBAR_ITEM_LOCATION, SIDEBAR_ITEM_TYPES } from '../../sidebarItems/types/baseTypes'
import type { SidebarItemName } from '../../sidebarItems/validation/name'
import type { SidebarItemColor } from '../../sidebarItems/validation/color'
import type { SidebarItemIconName } from '../../sidebarItems/validation/icon'
import { createYjsDocument } from '../../yjsSync/functions/createYjsDocument'
import { uint8ToArrayBuffer } from '../../yjsSync/functions/uint8ToArrayBuffer'
import { blocksToYDoc } from '../blocknote'
import { logEditHistory } from '../../editHistory/log'
import { EDIT_HISTORY_ACTION } from '../../editHistory/types'
import type { CampaignMutationCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'
import type { CustomBlock } from '../editorSpecs'
import type { SidebarItemSlug } from '../../sidebarItems/validation/slug'

export async function createNote(
  ctx: CampaignMutationCtx,
  {
    name,
    parentTarget,
    iconName,
    color,
    content,
  }: {
    name: SidebarItemName
    parentTarget: ParsedCreateParentTarget
    iconName?: SidebarItemIconName
    color?: SidebarItemColor
    content?: Array<CustomBlock>
  },
): Promise<{ noteId: Id<'sidebarItems'>; slug: SidebarItemSlug }> {
  const resolvedParentId = await resolveOrCreateFolderPath(ctx, { parentTarget })
  const prepared = await prepareSidebarItemCreate(ctx, {
    parentId: resolvedParentId,
    name,
  })

  const userId = ctx.membership.userId

  const noteId = await ctx.db.insert('sidebarItems', {
    name: prepared.name,
    slug: prepared.slug,
    parentId: resolvedParentId,
    iconName: iconName ?? null,
    color: color ?? null,
    allPermissionLevel: null,
    campaignId: ctx.campaign._id,
    type: SIDEBAR_ITEM_TYPES.notes,
    location: SIDEBAR_ITEM_LOCATION.sidebar,
    previewStorageId: null,
    previewLockedUntil: null,
    previewClaimToken: null,
    previewUpdatedAt: null,
    deletionTime: null,
    deletedBy: null,
    updatedTime: null,
    updatedBy: null,
    createdBy: userId,
  })

  await ctx.db.insert('notes', {
    sidebarItemId: noteId,
  })

  let initialState: ArrayBuffer | undefined
  if (content && content.length > 0) {
    const persistedBlocks = await saveAllBlocksForNote(ctx, { noteId, content })
    await syncNoteLinks(ctx, {
      noteId,
      campaignId: ctx.campaign._id,
      blocks: persistedBlocks,
    })

    const doc = blocksToYDoc(content, 'document')
    try {
      initialState = uint8ToArrayBuffer(Y.encodeStateAsUpdate(doc))
    } finally {
      doc.destroy()
    }
  }

  await createYjsDocument(ctx, { documentId: noteId, initialState })

  await logEditHistory(ctx, {
    itemId: noteId,
    itemType: SIDEBAR_ITEM_TYPES.notes,
    action: EDIT_HISTORY_ACTION.created,
  })

  return { noteId, slug: prepared.slug }
}

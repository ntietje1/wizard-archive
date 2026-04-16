import * as Y from 'yjs'
import { saveAllBlocksForNote } from '../../blocks/functions/saveAllBlocksForNote'
import { syncNoteLinks } from '../../links/functions/syncNoteLinks'
import {
  findUniqueSidebarItemSlug,
  validateSidebarCreateParent,
  validateSidebarItemName,
} from '../../sidebarItems/validation'
import { SIDEBAR_ITEM_LOCATION, SIDEBAR_ITEM_TYPES } from '../../sidebarItems/types/baseTypes'
import { createYjsDocument } from '../../yjsSync/functions/createYjsDocument'
import { uint8ToArrayBuffer } from '../../yjsSync/functions/uint8ToArrayBuffer'
import { blocksToYDoc } from '../blocknote'
import { logEditHistory } from '../../editHistory/log'
import { EDIT_HISTORY_ACTION } from '../../editHistory/types'
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
    name: string
    parentId: Id<'sidebarItems'> | null
    iconName?: string
    color?: string
    content?: Array<CustomBlock>
  },
): Promise<{ noteId: Id<'sidebarItems'>; slug: string }> {
  name = name.trim()

  await validateSidebarCreateParent(ctx, { parentId })
  await validateSidebarItemName(ctx, {
    parentId,
    name,
  })

  const uniqueSlug = await findUniqueSidebarItemSlug(ctx, {
    name,
  })

  const userId = ctx.membership.userId

  const noteId = await ctx.db.insert('sidebarItems', {
    name,
    slug: uniqueSlug,
    parentId,
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

  return { noteId, slug: uniqueSlug }
}

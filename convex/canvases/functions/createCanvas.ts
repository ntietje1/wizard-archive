import * as Y from 'yjs'
import {
  findUniqueSidebarItemSlug,
  validateSidebarCreateParent,
  validateSidebarItemName,
} from '../../sidebarItems/validation'
import { SIDEBAR_ITEM_LOCATION, SIDEBAR_ITEM_TYPES } from '../../sidebarItems/types/baseTypes'
import { createYjsDocument } from '../../yjsSync/functions/createYjsDocument'
import { uint8ToArrayBuffer } from '../../yjsSync/functions/uint8ToArrayBuffer'
import { logEditHistory } from '../../editHistory/log'
import { EDIT_HISTORY_ACTION } from '../../editHistory/types'
import type { AuthMutationCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'

export async function createCanvas(
  ctx: AuthMutationCtx,
  {
    name,
    parentId,
    iconName,
    color,
    campaignId,
  }: {
    name: string
    parentId: Id<'folders'> | null
    iconName?: string
    color?: string
    campaignId: Id<'campaigns'>
  },
): Promise<{ canvasId: Id<'canvases'>; slug: string }> {
  const trimmedName = name.trim()

  await validateSidebarCreateParent(ctx, { campaignId, parentId })
  await validateSidebarItemName(ctx, {
    campaignId,
    parentId,
    name: trimmedName,
  })

  const uniqueSlug = await findUniqueSidebarItemSlug(ctx, {
    name: trimmedName,
    campaignId,
  })

  const profileId = ctx.user.profile._id

  const canvasId = await ctx.db.insert('canvases', {
    campaignId,
    name: trimmedName,
    slug: uniqueSlug,
    iconName: iconName ?? null,
    color: color ?? null,
    parentId,
    allPermissionLevel: null,
    type: SIDEBAR_ITEM_TYPES.canvases,
    location: SIDEBAR_ITEM_LOCATION.sidebar,
    previewStorageId: null,
    previewLockedUntil: null,
    previewClaimToken: null,
    previewUpdatedAt: null,
    deletionTime: null,
    deletedBy: null,
    updatedTime: null,
    updatedBy: null,
    createdBy: profileId,
  })

  // getMap calls create the named maps on the Y.Doc so they're included in the initial encoded state
  const doc = new Y.Doc()
  doc.getMap('nodes')
  doc.getMap('edges')
  doc.getMap('strokes')
  const initialState = uint8ToArrayBuffer(Y.encodeStateAsUpdate(doc))
  doc.destroy()

  await createYjsDocument(ctx, { documentId: canvasId, initialState })

  await logEditHistory(ctx, {
    itemId: canvasId,
    itemType: SIDEBAR_ITEM_TYPES.canvases,
    campaignId,
    action: EDIT_HISTORY_ACTION.created,
  })

  return { canvasId, slug: uniqueSlug }
}

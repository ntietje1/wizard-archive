import * as Y from 'yjs'
import {
  findUniqueSidebarItemSlug,
  validateSidebarCreateParent,
  validateSidebarItemName,
} from '../../sidebarItems/validation'
import { resolveOrCreateSidebarParentPath } from '../../folders/functions/createFolder'
import { SIDEBAR_ITEM_LOCATION, SIDEBAR_ITEM_TYPES } from '../../sidebarItems/types/baseTypes'
import { createYjsDocument } from '../../yjsSync/functions/createYjsDocument'
import { uint8ToArrayBuffer } from '../../yjsSync/functions/uint8ToArrayBuffer'
import { logEditHistory } from '../../editHistory/log'
import { EDIT_HISTORY_ACTION } from '../../editHistory/types'
import type { CampaignMutationCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'

export async function createCanvas(
  ctx: CampaignMutationCtx,
  {
    name,
    parentId,
    parentPath,
    iconName,
    color,
  }: {
    name: string
    parentId: Id<'sidebarItems'> | null
    parentPath?: Array<string>
    iconName?: string
    color?: string
  },
): Promise<{ canvasId: Id<'sidebarItems'>; slug: string }> {
  const trimmedName = name.trim()
  parentId = await resolveOrCreateSidebarParentPath(ctx, { parentId, parentPath })

  await validateSidebarCreateParent(ctx, { parentId })
  await validateSidebarItemName(ctx, {
    parentId,
    name: trimmedName,
  })

  const uniqueSlug = await findUniqueSidebarItemSlug(ctx, {
    name: trimmedName,
  })

  const userId = ctx.membership.userId

  const canvasId = await ctx.db.insert('sidebarItems', {
    campaignId: ctx.campaign._id,
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
    createdBy: userId,
  })

  await ctx.db.insert('canvases', {
    sidebarItemId: canvasId,
  })

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
    action: EDIT_HISTORY_ACTION.created,
  })

  return { canvasId, slug: uniqueSlug }
}

import * as Y from 'yjs'
import { prepareSidebarItemCreate } from '../../sidebarItems/validation/validation'
import type { ParsedCreateParentTarget } from '../../sidebarItems/validation/parent'
import { resolveOrCreateFolderPath } from '../../folders/functions/resolveOrCreateFolderPath'
import { SIDEBAR_ITEM_LOCATION, SIDEBAR_ITEM_TYPES } from '../../sidebarItems/types/baseTypes'
import type { SidebarItemName } from '../../sidebarItems/validation/name'
import type { SidebarItemColor } from '../../sidebarItems/validation/color'
import type { SidebarItemIconName } from '../../sidebarItems/validation/icon'
import type { SidebarItemSlug } from '../../sidebarItems/validation/slug'
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
    parentTarget,
    iconName,
    color,
  }: {
    name: SidebarItemName
    parentTarget: ParsedCreateParentTarget
    iconName?: SidebarItemIconName
    color?: SidebarItemColor
  },
): Promise<{ canvasId: Id<'sidebarItems'>; slug: SidebarItemSlug }> {
  const resolvedParentId = await resolveOrCreateFolderPath(ctx, { parentTarget })
  const prepared = await prepareSidebarItemCreate(ctx, {
    parentId: resolvedParentId,
    name,
  })

  const userId = ctx.membership.userId

  const canvasId = await ctx.db.insert('sidebarItems', {
    campaignId: ctx.campaign._id,
    name: prepared.name,
    slug: prepared.slug,
    iconName: iconName ?? null,
    color: color ?? null,
    parentId: resolvedParentId,
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

  return { canvasId, slug: prepared.slug }
}

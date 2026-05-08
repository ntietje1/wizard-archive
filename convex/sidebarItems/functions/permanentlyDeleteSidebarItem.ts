import { ERROR_CODE, throwClientError } from '../../errors'
import { CAMPAIGN_MEMBER_ROLE } from '../../campaigns/types'
import { PERMISSION_LEVEL } from '../../permissions/types'
import { hasAtLeastPermissionLevel } from '../../permissions/hasAtLeastPermissionLevel'
import { SIDEBAR_ITEM_LOCATION, SIDEBAR_ITEM_TYPES } from '../types/baseTypes'
import { hardDeleteTree } from './treeOperations'
import { getSidebarItem } from './getSidebarItem'
import { evaluatePermanentDelete } from '../operations/capabilities'
import { assertSidebarOperationAllowed } from './operationCapability'
import { collectSidebarChildrenMap } from '../operations/childrenMap'
import { normalizeTopLevelSelectedItems } from '../operations/selection'
import type { Id } from '../../_generated/dataModel'
import type { CampaignMutationCtx } from '../../functions'
import type { PermissionLevel } from '../../permissions/types'
import type { AnySidebarItemRow } from '../types/types'

const MAX_PERMANENT_DELETE_DEPTH = 50
type PermanentDeleteSource = AnySidebarItemRow & { myPermissionLevel: PermissionLevel }

async function loadPermanentDeleteSource(
  ctx: CampaignMutationCtx,
  itemId: Id<'sidebarItems'>,
): Promise<PermanentDeleteSource> {
  const rawItem = await getSidebarItem(ctx, itemId)
  if (!rawItem) {
    throwClientError(ERROR_CODE.NOT_FOUND, 'Item not found')
  }

  if (rawItem.location !== SIDEBAR_ITEM_LOCATION.trash) {
    throwClientError(ERROR_CODE.NOT_FOUND, 'This item is no longer in the trash')
  }

  const { membership } = ctx
  let permissionLevel: PermissionLevel = PERMISSION_LEVEL.FULL_ACCESS

  if (membership.role !== CAMPAIGN_MEMBER_ROLE.DM) {
    if (rawItem.type === SIDEBAR_ITEM_TYPES.folders) {
      throwClientError(ERROR_CODE.PERMISSION_DENIED, 'Only the DM can permanently delete folders')
    }

    const share = await ctx.db
      .query('sidebarItemShares')
      .withIndex('by_campaign_item_member', (q) =>
        q
          .eq('campaignId', rawItem.campaignId)
          .eq('sidebarItemId', itemId)
          .eq('campaignMemberId', membership._id),
      )
      .first()

    permissionLevel = share?.permissionLevel ?? PERMISSION_LEVEL.NONE
    if (!hasAtLeastPermissionLevel(permissionLevel, PERMISSION_LEVEL.FULL_ACCESS)) {
      throwClientError(
        ERROR_CODE.PERMISSION_DENIED,
        'You do not have sufficient permission for this item',
      )
    }
  }
  const item: PermanentDeleteSource = { ...rawItem, myPermissionLevel: permissionLevel }
  assertSidebarOperationAllowed(evaluatePermanentDelete({ role: membership.role }, item))
  return item
}

async function getTrashChildren(
  ctx: CampaignMutationCtx,
  parentId: Id<'sidebarItems'>,
): Promise<Array<AnySidebarItemRow>> {
  return await ctx.db
    .query('sidebarItems')
    .withIndex('by_campaign_location_parent_name', (q) =>
      q
        .eq('campaignId', ctx.campaign._id)
        .eq('location', SIDEBAR_ITEM_LOCATION.trash)
        .eq('parentId', parentId),
    )
    .collect()
}

async function normalizePermanentDeleteRoots(
  ctx: CampaignMutationCtx,
  sourceItems: Array<PermanentDeleteSource>,
): Promise<Array<PermanentDeleteSource>> {
  const folders = sourceItems.filter((item) => item.type === SIDEBAR_ITEM_TYPES.folders)
  const childrenMap = await collectSidebarChildrenMap<AnySidebarItemRow>({
    rootFolderIds: folders.map((folder) => folder._id),
    maxDepth: MAX_PERMANENT_DELETE_DEPTH,
    getChildren: async (parentId) => await getTrashChildren(ctx, parentId),
    onDepthExceeded: () => {
      throwClientError(ERROR_CODE.VALIDATION_FAILED, 'Max permanent delete planning depth exceeded')
    },
  })
  const allItems = new Map<Id<'sidebarItems'>, Pick<AnySidebarItemRow, '_id' | 'parentId'>>()

  for (const sourceItem of sourceItems) {
    allItems.set(sourceItem._id, sourceItem)
  }
  for (const children of childrenMap.values()) {
    for (const child of children) {
      allItems.set(child._id, child)
    }
  }

  return normalizeTopLevelSelectedItems(sourceItems, allItems)
}

export async function permanentlyDeleteSidebarItems(
  ctx: CampaignMutationCtx,
  { sourceItemIds }: { sourceItemIds: Array<Id<'sidebarItems'>> },
): Promise<Array<Id<'sidebarItems'>>> {
  const sourceItems = await Promise.all(
    sourceItemIds.map((itemId) => loadPermanentDeleteSource(ctx, itemId)),
  )
  const rootItems = await normalizePermanentDeleteRoots(ctx, sourceItems)

  for (const item of rootItems) {
    await hardDeleteTree(ctx, item)
  }

  return rootItems.map((item) => item._id)
}

export async function permanentlyDeleteSidebarItem(
  ctx: CampaignMutationCtx,
  { itemId }: { itemId: Id<'sidebarItems'> },
): Promise<void> {
  await permanentlyDeleteSidebarItems(ctx, { sourceItemIds: [itemId] })
}

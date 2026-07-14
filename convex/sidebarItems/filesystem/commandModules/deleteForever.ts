import { ERROR_CODE } from '../../../../shared/errors/client'
import { throwClientError } from '../../../errors'
import { CAMPAIGN_MEMBER_ROLE } from '../../../../shared/campaigns/types'
import { PERMISSION_LEVEL } from '../../../../shared/permissions/types'
import { hasAtLeastPermissionLevel } from '../../../../shared/permissions/hasAtLeastPermissionLevel'
import {
  RESOURCE_STATUS,
  RESOURCE_TYPES,
} from '@wizard-archive/editor/resources/items-persistence-contract'
import { isTrashedSidebarItem } from '../../types/status'
import { evaluatePermanentDelete } from '@wizard-archive/editor/resources/operation-capabilities'
import { normalizeSelectedRoots } from '@wizard-archive/editor/resources/selection-roots'
import type { ResourceCommand } from '@wizard-archive/editor/resources/transaction-contract'
import { assertSidebarOperationAllowed, operationActorFromRole } from '../capabilities'
import { collectSidebarChildrenMap } from '../children'
import { loadSidebarItemAncestorMap } from '../ancestors'
import { buildPermanentDeleteDelta } from './permanentDelete'
import { getSidebarItemRow } from '../sidebarItemRows'
import { toSidebarOperationItem, toSidebarOperationItems } from '../readModel'
import type { CampaignMutationCtx } from '../../../functions'
import type { Doc, Id } from '../../../_generated/dataModel'
import type { PermissionLevel } from '../../../../shared/permissions/types'
import type { StoredResourceDelta } from '../deltas'
import { requireSidebarItemRows } from '../../functions/sidebarItemIdentity'
const MAX_PERMANENT_DELETE_DEPTH = 50
const MAX_PERMANENT_DELETE_BATCH_SIZE = 100
type StoredSidebarItemRow = Doc<'sidebarItems'>

type DeleteForeverFileSystemCommand = Extract<ResourceCommand, { type: 'deleteForever' }>

type PermanentDeleteSource = StoredSidebarItemRow & { myPermissionLevel: PermissionLevel }

async function loadPermanentDeleteSource(
  ctx: CampaignMutationCtx,
  itemId: Id<'sidebarItems'>,
): Promise<PermanentDeleteSource> {
  const rawItem = await getSidebarItemRow(ctx, itemId)
  if (!rawItem) {
    throwClientError(ERROR_CODE.NOT_FOUND, 'Item not found')
  }

  if (!isTrashedSidebarItem(rawItem)) {
    throwClientError(ERROR_CODE.NOT_FOUND, 'This item is no longer in the trash')
  }

  const { membership } = ctx
  let permissionLevel: PermissionLevel = PERMISSION_LEVEL.FULL_ACCESS

  if (membership.role !== CAMPAIGN_MEMBER_ROLE.DM) {
    if (rawItem.type === RESOURCE_TYPES.folders) {
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
  assertSidebarOperationAllowed(
    evaluatePermanentDelete(operationActorFromRole(membership.role), {
      ...toSidebarOperationItem(item),
      myPermissionLevel: permissionLevel,
    }),
  )
  return item
}

async function getTrashChildren(
  ctx: CampaignMutationCtx,
  parentId: Id<'sidebarItems'>,
): Promise<Array<StoredSidebarItemRow>> {
  return await ctx.db
    .query('sidebarItems')
    .withIndex('by_campaign_status_parent_name_deletionTime', (q) =>
      q
        .eq('campaignId', ctx.campaign._id)
        .eq('status', RESOURCE_STATUS.trashed)
        .eq('parentId', parentId),
    )
    .collect()
}

async function normalizePermanentDeleteRoots(
  ctx: CampaignMutationCtx,
  sourceItems: Array<PermanentDeleteSource>,
): Promise<{ rootItems: Array<PermanentDeleteSource>; affectedItemCount: number }> {
  const folders = sourceItems.filter((item) => item.type === RESOURCE_TYPES.folders)
  const childrenMap = await collectSidebarChildrenMap<StoredSidebarItemRow>({
    rootFolderIds: folders.map((folder) => folder._id),
    maxDepth: MAX_PERMANENT_DELETE_DEPTH,
    getChildren: (parentId) => getTrashChildren(ctx, parentId),
    onDepthExceeded: () => {
      throwClientError(ERROR_CODE.VALIDATION_FAILED, 'Max permanent delete planning depth exceeded')
    },
  })
  const itemsById = new Map<Id<'sidebarItems'>, ReturnType<typeof toSidebarOperationItem>>()
  const affectedItemIds = new Set<Id<'sidebarItems'>>()
  for (const item of sourceItems) {
    itemsById.set(item._id, toSidebarOperationItem(item))
    affectedItemIds.add(item._id)
  }
  for (const children of childrenMap.values()) {
    for (const child of children) {
      itemsById.set(child._id, toSidebarOperationItem(child))
      affectedItemIds.add(child._id)
    }
  }
  const ancestorItemsById = await loadSidebarItemAncestorMap(ctx, {
    items: sourceItems,
    itemsById,
    maxDepth: MAX_PERMANENT_DELETE_DEPTH,
  })
  const rootsById = new Set(
    normalizeSelectedRoots(toSidebarOperationItems(sourceItems), ancestorItemsById).map(
      (item) => item.id,
    ),
  )
  return {
    rootItems: sourceItems.filter((item) => rootsById.has(item._id)),
    affectedItemCount: affectedItemIds.size,
  }
}

export async function executeDeleteForeverCommand(
  ctx: CampaignMutationCtx,
  {
    command,
  }: {
    command: DeleteForeverFileSystemCommand
  },
): Promise<StoredResourceDelta> {
  if (command.itemIds.length === 0) {
    return await buildPermanentDeleteDelta(ctx, command, [])
  }

  const sourceRows = await requireSidebarItemRows(ctx, command.itemIds)
  const sourceItems = await Promise.all(
    sourceRows.map((row) => loadPermanentDeleteSource(ctx, row._id)),
  )
  const { rootItems, affectedItemCount } = await normalizePermanentDeleteRoots(ctx, sourceItems)
  if (affectedItemCount > MAX_PERMANENT_DELETE_BATCH_SIZE) {
    throwClientError(
      ERROR_CODE.VALIDATION_FAILED,
      `Permanent delete can delete at most ${MAX_PERMANENT_DELETE_BATCH_SIZE} items at once`,
    )
  }

  return await buildPermanentDeleteDelta(ctx, command, rootItems)
}

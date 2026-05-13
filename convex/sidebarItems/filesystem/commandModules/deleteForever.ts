import { ERROR_CODE, throwClientError } from '../../../errors'
import { CAMPAIGN_MEMBER_ROLE } from '../../../campaigns/types'
import { PERMISSION_LEVEL } from '../../../permissions/types'
import { hasAtLeastPermissionLevel } from '../../../permissions/hasAtLeastPermissionLevel'
import { SIDEBAR_ITEM_STATUS, SIDEBAR_ITEM_TYPES } from '../../types/baseTypes'
import { isTrashedSidebarItem } from '../../types/status'
import { getSidebarItem } from '../../functions/getSidebarItem'
import { assertSidebarOperationAllowed, evaluatePermanentDelete } from '../capabilities'
import { collectSidebarChildrenMap } from '../children'
import { normalizeTopLevelSelectedItemsWithDescendants } from '../selection'
import { createFileSystemWriteSession } from '../deltas'
import { FILE_SYSTEM_EVENT_TYPE, fileSystemSelfEvents } from '../receipts'
import type { CampaignMutationCtx } from '../../../functions'
import type { DeleteForeverFileSystemCommand } from '../commands'
import type { FileSystemDelta } from '../receipts'
import type { Id } from '../../../_generated/dataModel'
import type { PermissionLevel } from '../../../permissions/types'
import type { AnySidebarItemRow } from '../../types/types'

const MAX_PERMANENT_DELETE_DEPTH = 50
const MAX_PERMANENT_DELETE_BATCH_SIZE = 100

type PermanentDeleteSource = AnySidebarItemRow & { myPermissionLevel: PermissionLevel }

async function loadPermanentDeleteSource(
  ctx: CampaignMutationCtx,
  itemId: Id<'sidebarItems'>,
): Promise<PermanentDeleteSource> {
  const rawItem = await getSidebarItem(ctx, itemId)
  if (!rawItem) {
    throwClientError(ERROR_CODE.NOT_FOUND, 'Item not found')
  }

  if (!isTrashedSidebarItem(rawItem)) {
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
    .withIndex('by_campaign_status_parent_name_deletionTime', (q) =>
      q
        .eq('campaignId', ctx.campaign._id)
        .eq('status', SIDEBAR_ITEM_STATUS.trashed)
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
    getChildren: (parentId) => getTrashChildren(ctx, parentId),
    onDepthExceeded: () => {
      throwClientError(ERROR_CODE.VALIDATION_FAILED, 'Max permanent delete planning depth exceeded')
    },
  })
  return normalizeTopLevelSelectedItemsWithDescendants(sourceItems, childrenMap)
}

export async function executeDeleteForeverCommand(
  ctx: CampaignMutationCtx,
  {
    command,
  }: {
    command: DeleteForeverFileSystemCommand
  },
): Promise<FileSystemDelta> {
  const session = createFileSystemWriteSession(ctx)

  if (command.itemIds.length === 0) {
    return await session.build({
      command,
      events: [],
      undoable: false,
    })
  }

  if (command.itemIds.length > MAX_PERMANENT_DELETE_BATCH_SIZE) {
    throwClientError(
      ERROR_CODE.VALIDATION_FAILED,
      `Batch size cannot exceed ${MAX_PERMANENT_DELETE_BATCH_SIZE} items`,
    )
  }

  const sourceItems = await Promise.all(
    command.itemIds.map((itemId) => loadPermanentDeleteSource(ctx, itemId)),
  )
  const rootItems = await normalizePermanentDeleteRoots(ctx, sourceItems)

  for (const item of rootItems) {
    await session.deleteSidebarTree(item)
  }

  const events = fileSystemSelfEvents(
    FILE_SYSTEM_EVENT_TYPE.deletedForever,
    rootItems.map((item) => item._id),
  )

  return await session.build({
    command,
    events,
    undoable: false,
  })
}

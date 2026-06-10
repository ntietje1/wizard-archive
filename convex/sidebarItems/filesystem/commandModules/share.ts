import { ERROR_CODE } from '../../../../shared/errors/client'
import { throwClientError } from '../../../errors'
import { FILE_SYSTEM_EVENT_TYPE } from '../../../../shared/sidebar-items/filesystem/receipts'
import { createFileSystemWriteSession } from '../deltas'
import {
  clearSidebarItemsMemberPermission,
  setSidebarItemsMemberPermission,
} from '../../../sidebarShares/functions/sidebarItemShareMutations'
import { setAllPlayersPermissionForSidebarItems } from '../../../sidebarShares/functions/setAllPlayersPermissionForSidebarItems'
import { setFolderInheritShares } from '../../../sidebarShares/functions/setFolderInheritShares'
import { getSidebarItemShareRow } from '../shareRows'
import type { Id } from '../../../_generated/dataModel'
import type { CampaignMutationCtx } from '../../../functions'
import type {
  ClearSidebarItemsMemberPermissionFileSystemCommand,
  SetAllPlayersPermissionFileSystemCommand,
  SetFolderInheritSharesFileSystemCommand,
  SetSidebarItemsMemberPermissionFileSystemCommand,
} from '../../../../shared/sidebar-items/filesystem/commands'
import type {
  FileSystemDelta,
  FolderSharePatchRow,
  SidebarItemSharePatchRow,
} from '../../../../shared/sidebar-items/filesystem/receipts'
import type { SidebarItemPatchRow } from '../../../../shared/sidebar-items/filesystem/types'

type ShareCommand =
  | SetAllPlayersPermissionFileSystemCommand
  | SetSidebarItemsMemberPermissionFileSystemCommand
  | ClearSidebarItemsMemberPermissionFileSystemCommand
  | SetFolderInheritSharesFileSystemCommand

async function loadSidebarItemSnapshots(
  ctx: CampaignMutationCtx,
  itemIds: Array<Id<'sidebarItems'>>,
) {
  const snapshots = new Map<Id<'sidebarItems'>, SidebarItemPatchRow>()
  for (const itemId of itemIds) {
    const item = await ctx.db.get('sidebarItems', itemId)
    if (!item || item.campaignId !== ctx.campaign._id) {
      throwClientError(ERROR_CODE.NOT_FOUND, 'Item not found')
    }
    snapshots.set(itemId, item)
  }
  return snapshots
}

async function loadSidebarItemShareSnapshots(
  ctx: CampaignMutationCtx,
  {
    itemIds,
    campaignMemberId,
  }: {
    itemIds: Array<Id<'sidebarItems'>>
    campaignMemberId: Id<'campaignMembers'>
  },
) {
  const snapshots = new Map<Id<'sidebarItems'>, SidebarItemSharePatchRow | null>()
  for (const itemId of itemIds) {
    snapshots.set(
      itemId,
      await getSidebarItemShareRow(ctx, { sidebarItemId: itemId, campaignMemberId }),
    )
  }
  return snapshots
}

async function getFolderShareSnapshot(
  ctx: CampaignMutationCtx,
  folderId: Id<'sidebarItems'>,
): Promise<FolderSharePatchRow> {
  const folder = await ctx.db
    .query('folders')
    .withIndex('by_sidebarItemId', (q) => q.eq('sidebarItemId', folderId))
    .unique()
  if (!folder) throwClientError(ERROR_CODE.NOT_FOUND, 'Folder not found')
  return { folderId, inheritShares: folder.inheritShares }
}

function changedEvents(itemIds: Array<Id<'sidebarItems'>>) {
  return itemIds.map((itemId) => ({ type: FILE_SYSTEM_EVENT_TYPE.updated, itemId }))
}

async function executeAllPlayersCommand(
  ctx: CampaignMutationCtx,
  command: SetAllPlayersPermissionFileSystemCommand,
): Promise<FileSystemDelta> {
  const session = createFileSystemWriteSession(ctx)
  const before = await loadSidebarItemSnapshots(ctx, command.itemIds)

  await setAllPlayersPermissionForSidebarItems(ctx, {
    sidebarItemIds: command.itemIds,
    permissionLevel: command.permissionLevel,
  })

  const after = await loadSidebarItemSnapshots(ctx, command.itemIds)
  const changedItemIds: Array<Id<'sidebarItems'>> = []
  for (const [itemId, beforeItem] of before) {
    const afterItem = after.get(itemId)
    if (!afterItem) throwClientError(ERROR_CODE.NOT_FOUND, 'Item not found')
    if (beforeItem.allPermissionLevel !== afterItem.allPermissionLevel) {
      changedItemIds.push(itemId)
      session.recordSidebarItemChange(beforeItem, afterItem)
    }
  }

  return await session.build({
    command,
    events: changedEvents(changedItemIds),
  })
}

async function executeMemberCommand(
  ctx: CampaignMutationCtx,
  command: SetSidebarItemsMemberPermissionFileSystemCommand,
): Promise<FileSystemDelta> {
  const session = createFileSystemWriteSession(ctx)
  const before = await loadSidebarItemShareSnapshots(ctx, {
    itemIds: command.itemIds,
    campaignMemberId: command.campaignMemberId,
  })

  await setSidebarItemsMemberPermission(ctx, {
    sidebarItemIds: command.itemIds,
    campaignMemberId: command.campaignMemberId,
    permissionLevel: command.permissionLevel,
  })

  return await recordMemberShareChanges(ctx, session, command, before)
}

async function executeClearMemberCommand(
  ctx: CampaignMutationCtx,
  command: ClearSidebarItemsMemberPermissionFileSystemCommand,
): Promise<FileSystemDelta> {
  const session = createFileSystemWriteSession(ctx)
  const before = await loadSidebarItemShareSnapshots(ctx, {
    itemIds: command.itemIds,
    campaignMemberId: command.campaignMemberId,
  })

  await clearSidebarItemsMemberPermission(ctx, {
    sidebarItemIds: command.itemIds,
    campaignMemberId: command.campaignMemberId,
  })

  return await recordMemberShareChanges(ctx, session, command, before)
}

async function recordMemberShareChanges(
  ctx: CampaignMutationCtx,
  session: ReturnType<typeof createFileSystemWriteSession>,
  command:
    | SetSidebarItemsMemberPermissionFileSystemCommand
    | ClearSidebarItemsMemberPermissionFileSystemCommand,
  before: Map<Id<'sidebarItems'>, SidebarItemSharePatchRow | null>,
) {
  const changedItemIds: Array<Id<'sidebarItems'>> = []
  for (const itemId of command.itemIds) {
    const after = await getSidebarItemShareRow(ctx, {
      sidebarItemId: itemId,
      campaignMemberId: command.campaignMemberId,
    })
    const beforeShare = before.get(itemId) ?? null
    session.recordSidebarItemShareChange(beforeShare, after)
    if (beforeShare?.permissionLevel !== after?.permissionLevel) changedItemIds.push(itemId)
  }

  return await session.build({
    command,
    events: changedEvents(changedItemIds),
  })
}

async function executeFolderInheritCommand(
  ctx: CampaignMutationCtx,
  command: SetFolderInheritSharesFileSystemCommand,
): Promise<FileSystemDelta> {
  const session = createFileSystemWriteSession(ctx)
  const before = await getFolderShareSnapshot(ctx, command.folderId)

  await setFolderInheritShares(ctx, {
    folderId: command.folderId,
    inheritShares: command.inheritShares,
  })

  const after = await getFolderShareSnapshot(ctx, command.folderId)
  session.recordFolderShareChange(before, after)

  return await session.build({
    command,
    events: changedEvents(before.inheritShares === after.inheritShares ? [] : [command.folderId]),
  })
}

export async function executeShareCommand(
  ctx: CampaignMutationCtx,
  { command }: { command: ShareCommand },
): Promise<FileSystemDelta> {
  switch (command.type) {
    case 'setAllPlayersPermission':
      return await executeAllPlayersCommand(ctx, command)
    case 'setSidebarItemsMemberPermission':
      return await executeMemberCommand(ctx, command)
    case 'clearSidebarItemsMemberPermission':
      return await executeClearMemberCommand(ctx, command)
    case 'setFolderInheritShares':
      return await executeFolderInheritCommand(ctx, command)
  }
}

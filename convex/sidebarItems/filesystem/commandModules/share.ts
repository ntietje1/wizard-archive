import { ERROR_CODE } from '../../../../shared/errors/client'
import { CAMPAIGN_MEMBER_ROLE } from '../../../../shared/campaigns/types'
import { throwClientError } from '../../../errors'
import { RESOURCE_EVENT_TYPE } from '@wizard-archive/editor/resources/transaction-contract'
import type { ResourceCommand } from '@wizard-archive/editor/resources/transaction-contract'
import type { ResourceChange } from '@wizard-archive/editor/resources/patch-contract'
import { createFileSystemWriteSession } from '../deltas'
import {
  clearResourcesMemberPermission,
  setResourcesMemberPermission,
} from '../../../sidebarShares/functions/sidebarItemShareMutations'
import { setResourceAudiencePermissionForSidebarItems } from '../../../sidebarShares/functions/setResourceAudiencePermissionForSidebarItems'
import { setFolderInheritShares } from '../../../sidebarShares/functions/setFolderInheritShares'
import { getSidebarItemShareRow } from '../shareRows'
import type { Id } from '../../../_generated/dataModel'
import type { CampaignMutationCtx } from '../../../functions'
import type {
  StoredResourceDelta,
  StoredResourcePatchRow,
  StoredSidebarItemSharePatchRow,
} from '../deltas'
import { requireCampaignMemberRow } from '../../../campaigns/functions/campaignIdentity'

type FolderSharePatchRow = Extract<ResourceChange, { type: 'updateFolderShare' }>['before']
type SidebarItemSharePatchRow = StoredSidebarItemSharePatchRow

type ClearSidebarItemsMemberPermissionFileSystemCommand = Extract<
  ResourceCommand,
  { type: 'clearResourcesMemberPermission' }
>
type SetAllPlayersPermissionFileSystemCommand = Extract<
  ResourceCommand,
  { type: 'setResourceAudiencePermission' }
>
type SetFolderInheritSharesFileSystemCommand = Extract<
  ResourceCommand,
  { type: 'setFolderInheritShares' }
>
type SetSidebarItemsMemberPermissionFileSystemCommand = Extract<
  ResourceCommand,
  { type: 'setResourcesMemberPermission' }
>

type ShareCommand =
  | SetAllPlayersPermissionFileSystemCommand
  | SetSidebarItemsMemberPermissionFileSystemCommand
  | ClearSidebarItemsMemberPermissionFileSystemCommand
  | SetFolderInheritSharesFileSystemCommand

function assertDmShareCommand(ctx: CampaignMutationCtx) {
  if (ctx.membership.role !== CAMPAIGN_MEMBER_ROLE.DM) {
    throwClientError(ERROR_CODE.PERMISSION_DENIED, 'Only the DM can perform this action')
  }
}

async function loadSidebarItemSnapshots(
  ctx: CampaignMutationCtx,
  itemIds: Array<Id<'sidebarItems'>>,
) {
  const items = await Promise.all(itemIds.map((itemId) => ctx.db.get('sidebarItems', itemId)))
  const snapshots = new Map<Id<'sidebarItems'>, StoredResourcePatchRow>()
  for (let index = 0; index < itemIds.length; index++) {
    const itemId = itemIds[index]!
    const item = items[index]
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
  const shares = await Promise.all(
    itemIds.map((itemId) =>
      getSidebarItemShareRow(ctx, { sidebarItemId: itemId, campaignMemberId }),
    ),
  )
  const snapshots = new Map<Id<'sidebarItems'>, SidebarItemSharePatchRow | null>()
  for (let index = 0; index < itemIds.length; index++) {
    snapshots.set(itemIds[index]!, shares[index] ?? null)
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
  return itemIds.map((itemId) => ({ type: RESOURCE_EVENT_TYPE.updated, itemId }))
}

async function executeAllPlayersCommand(
  ctx: CampaignMutationCtx,
  command: SetAllPlayersPermissionFileSystemCommand,
): Promise<StoredResourceDelta> {
  const session = createFileSystemWriteSession(ctx)
  const before = await loadSidebarItemSnapshots(ctx, command.itemIds)

  await setResourceAudiencePermissionForSidebarItems(ctx, {
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
): Promise<StoredResourceDelta> {
  const session = createFileSystemWriteSession(ctx)
  const member = await requireShareCommandMember(ctx, command.campaignMemberId)
  const before = await loadSidebarItemShareSnapshots(ctx, {
    itemIds: command.itemIds,
    campaignMemberId: member._id,
  })

  await setResourcesMemberPermission(ctx, {
    sidebarItemIds: command.itemIds,
    campaignMemberId: member._id,
    permissionLevel: command.permissionLevel,
  })

  return await recordMemberShareChanges(ctx, session, command, member._id, before)
}

async function executeClearMemberCommand(
  ctx: CampaignMutationCtx,
  command: ClearSidebarItemsMemberPermissionFileSystemCommand,
): Promise<StoredResourceDelta> {
  const session = createFileSystemWriteSession(ctx)
  const member = await requireShareCommandMember(ctx, command.campaignMemberId)
  const before = await loadSidebarItemShareSnapshots(ctx, {
    itemIds: command.itemIds,
    campaignMemberId: member._id,
  })

  await clearResourcesMemberPermission(ctx, {
    sidebarItemIds: command.itemIds,
    campaignMemberId: member._id,
  })

  return await recordMemberShareChanges(ctx, session, command, member._id, before)
}

async function requireShareCommandMember(
  ctx: CampaignMutationCtx,
  memberId: SetSidebarItemsMemberPermissionFileSystemCommand['campaignMemberId'],
) {
  const member = await requireCampaignMemberRow(ctx, memberId)
  if (member.campaignId !== ctx.campaign._id) {
    throwClientError(ERROR_CODE.NOT_FOUND, 'Campaign member not found')
  }
  return member
}

async function recordMemberShareChanges(
  ctx: CampaignMutationCtx,
  session: ReturnType<typeof createFileSystemWriteSession>,
  command:
    | SetSidebarItemsMemberPermissionFileSystemCommand
    | ClearSidebarItemsMemberPermissionFileSystemCommand,
  campaignMemberId: Id<'campaignMembers'>,
  before: Map<Id<'sidebarItems'>, SidebarItemSharePatchRow | null>,
) {
  const shares = await Promise.all(
    command.itemIds.map((itemId) =>
      getSidebarItemShareRow(ctx, {
        sidebarItemId: itemId,
        campaignMemberId,
      }),
    ),
  )
  const changedItemIds: Array<Id<'sidebarItems'>> = []
  for (let index = 0; index < command.itemIds.length; index++) {
    const itemId = command.itemIds[index]!
    const after = shares[index] ?? null
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
): Promise<StoredResourceDelta> {
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
): Promise<StoredResourceDelta> {
  assertDmShareCommand(ctx)

  switch (command.type) {
    case 'setResourceAudiencePermission':
      return await executeAllPlayersCommand(ctx, command)
    case 'setResourcesMemberPermission':
      return await executeMemberCommand(ctx, command)
    case 'clearResourcesMemberPermission':
      return await executeClearMemberCommand(ctx, command)
    case 'setFolderInheritShares':
      return await executeFolderInheritCommand(ctx, command)
  }
}

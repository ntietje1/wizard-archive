import { CAMPAIGN_MEMBER_ROLE } from '../../../shared/campaigns/types'
import { PERMISSION_LEVEL } from '../../../shared/permissions/types'
import { normalizeExplicitSharePermissionLevel } from '../../../shared/permissions/share-permissions'
import { getSidebarItem } from '../../sidebarItems/functions/getSidebarItem'
import { RESOURCE_TYPES } from '@wizard-archive/editor/resources/items-persistence-contract'
import type { AnyResourceRow } from '@wizard-archive/editor/resources/resource-contract'
import type { CampaignQueryCtx } from '../../functions'
import type { Doc, Id } from '../../_generated/dataModel'
import type { QueryCtx } from '../../_generated/server'
import type { PermissionLevel } from '../../../shared/permissions/types'
import type { CampaignMemberRow } from '../../../shared/campaigns/types'
type SidebarPermissionCtx = Pick<QueryCtx, 'db'> & {
  campaign: Pick<Doc<'campaigns'>, '_id'>
}

type InheritedMemberPermission = { level: PermissionLevel; folderName: string | null }
type InheritedPermissionsResult = {
  allPlayers: { level: PermissionLevel | null; folderName: string | null }
  members: Record<Id<'campaignMembers'>, InheritedMemberPermission>
}

function createInheritedPermissionsResult(): InheritedPermissionsResult {
  return {
    allPlayers: { level: null, folderName: null },
    members: {} as Record<Id<'campaignMembers'>, InheritedMemberPermission>,
  }
}

async function applyFolderMemberShares(
  ctx: SidebarPermissionCtx,
  {
    campaignId,
    folderId,
    folderName,
    result,
    unresolvedMembers,
  }: {
    campaignId: Id<'campaigns'>
    folderId: Id<'sidebarItems'>
    folderName: string
    result: InheritedPermissionsResult
    unresolvedMembers: Set<Id<'campaignMembers'>>
  },
) {
  if (unresolvedMembers.size === 0) return

  const folderShares = await ctx.db
    .query('sidebarItemShares')
    .withIndex('by_campaign_item_member', (q) =>
      q.eq('campaignId', campaignId).eq('sidebarItemId', folderId),
    )
    .collect()
  for (const share of folderShares) {
    if (!unresolvedMembers.has(share.campaignMemberId)) continue

    result.members[share.campaignMemberId] = {
      level: normalizeExplicitSharePermissionLevel(share.permissionLevel),
      folderName,
    }
    unresolvedMembers.delete(share.campaignMemberId)
  }
}

function applyFolderAllPlayersPermission(
  {
    folderName,
    allPermissionLevel,
  }: {
    folderName: string
    allPermissionLevel: PermissionLevel | null
  },
  {
    allPlayersResolved,
    result,
    unresolvedMembers,
  }: {
    allPlayersResolved: boolean
    result: InheritedPermissionsResult
    unresolvedMembers: Set<Id<'campaignMembers'>>
  },
) {
  if (allPermissionLevel === null) return allPlayersResolved

  if (!allPlayersResolved) {
    result.allPlayers = {
      level: allPermissionLevel,
      folderName,
    }
  }

  for (const memberId of unresolvedMembers) {
    result.members[memberId] = {
      level: allPermissionLevel,
      folderName,
    }
  }
  unresolvedMembers.clear()
  return true
}

function fillUnresolvedMembersWithNone(
  result: InheritedPermissionsResult,
  unresolvedMembers: Set<Id<'campaignMembers'>>,
) {
  for (const memberId of unresolvedMembers) {
    result.members[memberId] = {
      level: PERMISSION_LEVEL.NONE,
      folderName: null,
    }
  }
}

export async function resolveInheritedPermissions(
  ctx: SidebarPermissionCtx,
  {
    parentId,
    campaignId,
    memberIds,
  }: {
    parentId: Id<'sidebarItems'> | null
    campaignId: Id<'campaigns'>
    memberIds: Array<Id<'campaignMembers'>>
  },
): Promise<InheritedPermissionsResult> {
  const result = createInheritedPermissionsResult()
  const unresolvedMembers = new Set(memberIds)
  let allPlayersResolved = false

  let currentParentId = parentId
  while (currentParentId) {
    const folder = await getSidebarItem(ctx, currentParentId)
    if (!folder) break

    const inheritsFolderShares =
      folder.type === RESOURCE_TYPES.folders && folder.inheritShares === true
    if (inheritsFolderShares) {
      await applyFolderMemberShares(ctx, {
        campaignId,
        folderId: currentParentId,
        folderName: folder.name,
        result,
        unresolvedMembers,
      })
      allPlayersResolved = applyFolderAllPlayersPermission(
        { folderName: folder.name, allPermissionLevel: folder.allPermissionLevel },
        { allPlayersResolved, result, unresolvedMembers },
      )
    }

    if (allPlayersResolved && unresolvedMembers.size === 0) break

    currentParentId = folder.parentId
  }

  fillUnresolvedMembersWithNone(result, unresolvedMembers)
  return result
}

export async function getSidebarItemPermissionLevel(
  ctx: CampaignQueryCtx,
  { item }: { item: Pick<AnyResourceRow, 'id' | 'campaignId' | 'allPermissionLevel' | 'parentId'> },
): Promise<PermissionLevel> {
  return await getSidebarItemPermissionLevelForMembership(ctx, {
    item,
    membership: ctx.membership,
  })
}

export async function getSidebarItemPermissionLevelForMembership(
  ctx: SidebarPermissionCtx,
  {
    item,
    membership,
  }: {
    item: Pick<AnyResourceRow, 'id' | 'campaignId' | 'allPermissionLevel' | 'parentId'>
    membership: CampaignMemberRow
  },
): Promise<PermissionLevel> {
  const campaignId = item.campaignId

  if (membership.role === CAMPAIGN_MEMBER_ROLE.DM) {
    return PERMISSION_LEVEL.FULL_ACCESS
  }

  const checkId = membership._id

  const share = await ctx.db
    .query('sidebarItemShares')
    .withIndex('by_campaign_item_member', (q) =>
      q.eq('campaignId', campaignId).eq('sidebarItemId', item.id).eq('campaignMemberId', checkId),
    )
    .unique()
  if (share) return normalizeExplicitSharePermissionLevel(share.permissionLevel)

  if (item.allPermissionLevel !== null) return item.allPermissionLevel

  const inherited = await resolveInheritedPermissions(ctx, {
    parentId: item.parentId ?? null,
    campaignId,
    memberIds: [checkId],
  })
  return inherited.members[checkId]?.level ?? PERMISSION_LEVEL.NONE
}

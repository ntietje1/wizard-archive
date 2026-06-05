import { hasAtLeastPermissionLevel } from 'shared/permissions/hasAtLeastPermissionLevel'
import { normalizeExplicitSharePermissionLevel } from 'shared/permissions/share-permissions'
import { PERMISSION_LEVEL } from 'shared/permissions/types'
import type { PermissionLevel } from 'shared/permissions/types'
import type { CampaignMemberSummary } from 'shared/campaigns/types'
import type { AnySidebarItem } from 'shared/sidebar-items/model-types'
import type { Id } from 'convex/_generated/dataModel'
import type { Folder } from 'shared/folders/types'
import type { CampaignActor } from 'shared/campaigns/actor'

type CampaignMemberId = CampaignMemberSummary['_id']

interface ActorPermissionContext {
  actor: CampaignActor | null
  allItemsMap: Map<Id<'sidebarItems'>, AnySidebarItem>
}

function getMemberPermission(
  item: AnySidebarItem | Folder,
  memberId: CampaignMemberId,
): PermissionLevel | null {
  const memberShare = item.shares.find((s) => s.campaignMemberId === memberId)
  return memberShare ? normalizeExplicitSharePermissionLevel(memberShare.permissionLevel) : null
}

function getAllPlayersPermission(item: AnySidebarItem | Folder): PermissionLevel | null {
  return item.allPermissionLevel ?? null
}

function resolveInheritedPermission(
  item: AnySidebarItem,
  memberId: CampaignMemberId,
  allItemsMap: Map<Id<'sidebarItems'>, AnySidebarItem>,
): { level: PermissionLevel; source: string } | null {
  let currentParentId = item.parentId
  const seen = new Set<Id<'sidebarItems'>>()

  while (currentParentId) {
    if (seen.has(currentParentId)) return null
    seen.add(currentParentId)

    const folder = allItemsMap.get(currentParentId) as Folder | undefined
    if (!folder) return null
    currentParentId = folder.parentId

    const memberPermission = getMemberPermission(folder, memberId)
    if (memberPermission !== null) return { level: memberPermission, source: folder.name }

    const allPlayersPermission = getAllPlayersPermission(folder)
    if (allPlayersPermission !== null) {
      return { level: allPlayersPermission, source: folder.name }
    }
  }

  return null
}

/**
 * Client-side permission resolution mirroring server logic.
 * Walks the item's shares and parent chain to determine effective permission.
 */
export function resolveSidebarItemPermissionLevel(
  item: AnySidebarItem,
  memberId: CampaignMemberId,
  allItemsMap: Map<Id<'sidebarItems'>, AnySidebarItem>,
): { level: PermissionLevel; source?: string } {
  const memberPermission = getMemberPermission(item, memberId)
  if (memberPermission !== null) return { level: memberPermission }

  const allPlayersPermission = getAllPlayersPermission(item)
  if (allPlayersPermission !== null) return { level: allPlayersPermission }

  return resolveInheritedPermission(item, memberId, allItemsMap) ?? { level: PERMISSION_LEVEL.NONE }
}

export function getActorPermissionLevel(
  item: AnySidebarItem,
  opts: ActorPermissionContext,
): PermissionLevel {
  if (opts.actor?.kind === 'dm') return PERMISSION_LEVEL.FULL_ACCESS
  if (opts.actor?.kind === 'dm_view_as') {
    return resolveSidebarItemPermissionLevel(item, opts.actor.memberId, opts.allItemsMap).level
  }
  return item.myPermissionLevel
}

export function getActorActionPermissionLevel(
  item: AnySidebarItem,
  opts: ActorPermissionContext,
): PermissionLevel {
  const permissionLevel = getActorPermissionLevel(item, opts)
  if (opts.actor?.kind !== 'dm_view_as') return permissionLevel
  return hasAtLeastPermissionLevel(permissionLevel, PERMISSION_LEVEL.VIEW)
    ? PERMISSION_LEVEL.VIEW
    : PERMISSION_LEVEL.NONE
}

export function actorCanMutateSidebarItem(
  item: AnySidebarItem,
  requiredLevel: PermissionLevel,
  opts: ActorPermissionContext,
): boolean {
  if (opts.actor?.kind === 'dm_view_as') return false
  return hasAtLeastPermissionLevel(getActorPermissionLevel(item, opts), requiredLevel)
}

/**
 * Unified permission check that handles DM / view-as / player branching.
 * - DM without view-as: always has permission
 * - DM with view-as: checks viewed player's resolved permission
 * - Regular player: checks their own myPermissionLevel from the backend
 */
export function effectiveHasAtLeastPermission(
  item: AnySidebarItem,
  requiredLevel: PermissionLevel,
  opts: {
    actor: CampaignActor | null
    allItemsMap: Map<Id<'sidebarItems'>, AnySidebarItem>
  },
): boolean {
  return hasAtLeastPermissionLevel(getActorPermissionLevel(item, opts), requiredLevel)
}

import type { CampaignMemberId, ResourceId } from '../../resources/domain-id'
import { hasAtLeastPermissionLevel } from '../../../../../shared/permissions/hasAtLeastPermissionLevel'
import { normalizeExplicitSharePermissionLevel } from '../../../../../shared/permissions/share-permissions'
import { PERMISSION_LEVEL } from '../../../../../shared/permissions/types'
import type { PermissionLevel } from '../../../../../shared/permissions/types'
import type { AnyItem, FolderItem } from '../../workspace/items'
import { RESOURCE_TYPES } from '../../workspace/items-persistence-contract'

export type EditorWorkspaceActor =
  | { kind: 'owner' }
  | { kind: 'participant' }
  | { kind: 'owner_view_as'; participantId: CampaignMemberId }

export interface ResourcePermissionContext {
  actor: EditorWorkspaceActor | null
  getItemById: (itemId: ResourceId) => AnyItem | null | undefined
}

function getMemberPermission(
  item: AnyItem | FolderItem,
  participantId: CampaignMemberId,
): PermissionLevel | null {
  const memberShare = item.shares.find((s) => s.campaignMemberId === participantId)
  return memberShare ? normalizeExplicitSharePermissionLevel(memberShare.permissionLevel) : null
}

function getAllPlayersPermission(item: AnyItem | FolderItem): PermissionLevel | null {
  return item.allPermissionLevel ?? null
}

function visitKnownAncestors(
  item: AnyItem,
  getItemById: ResourcePermissionContext['getItemById'],
  visit: (ancestor: AnyItem) => boolean,
) {
  let parentId = item.parentId
  const seen = new Set<ResourceId>()
  while (parentId) {
    if (seen.has(parentId)) return false
    seen.add(parentId)
    const parent = getItemById(parentId)
    if (!parent) return false
    if (!visit(parent)) return false
    parentId = parent.parentId
  }
  return true
}

function resolveInheritedPermission(
  item: AnyItem,
  participantId: CampaignMemberId,
  getItemById: ResourcePermissionContext['getItemById'],
): PermissionLevel | null {
  let inheritedPermission: PermissionLevel | null = null
  visitKnownAncestors(item, getItemById, (ancestor) => {
    if (ancestor.type !== RESOURCE_TYPES.folders) return true
    const folder = ancestor as FolderItem
    if (!folder.inheritShares) return false

    const memberPermission = getMemberPermission(folder, participantId)
    if (memberPermission !== null) {
      inheritedPermission = memberPermission
      return false
    }

    const allPlayersPermission = getAllPlayersPermission(folder)
    if (allPlayersPermission !== null) {
      inheritedPermission = allPlayersPermission
      return false
    }
    return true
  })

  return inheritedPermission
}

function resolveResourcePermissionLevel(
  item: AnyItem,
  participantId: CampaignMemberId,
  getItemById: ResourcePermissionContext['getItemById'],
): PermissionLevel {
  const memberPermission = getMemberPermission(item, participantId)
  if (memberPermission !== null) return memberPermission

  const allPlayersPermission = getAllPlayersPermission(item)
  if (allPlayersPermission !== null) return allPlayersPermission

  return resolveInheritedPermission(item, participantId, getItemById) ?? PERMISSION_LEVEL.NONE
}

function getActorResourcePermissionLevel(
  item: AnyItem,
  opts: ResourcePermissionContext,
): PermissionLevel {
  if (opts.actor?.kind === 'owner') return PERMISSION_LEVEL.FULL_ACCESS
  if (opts.actor?.kind === 'owner_view_as') {
    return resolveResourcePermissionLevel(item, opts.actor.participantId, opts.getItemById)
  }
  return item.myPermissionLevel
}

export function actorHasResourcePermission(
  item: AnyItem,
  requiredLevel: PermissionLevel,
  opts: ResourcePermissionContext,
): boolean {
  return hasAtLeastPermissionLevel(getActorResourcePermissionLevel(item, opts), requiredLevel)
}

export function actorCanMutateResource(
  item: AnyItem,
  requiredLevel: PermissionLevel,
  opts: ResourcePermissionContext,
): boolean {
  if (opts.actor?.kind === 'owner_view_as') return false
  return actorHasResourcePermission(item, requiredLevel, opts)
}

export function getMemberResourcePermissionLevel(
  item: AnyItem,
  participantId: CampaignMemberId,
  getItemById: ResourcePermissionContext['getItemById'],
): PermissionLevel {
  return resolveResourcePermissionLevel(item, participantId, getItemById)
}

export function canViewResourceAndKnownAncestors(
  item: AnyItem,
  permissionContext: ResourcePermissionContext,
): boolean {
  if (!actorHasResourcePermission(item, PERMISSION_LEVEL.VIEW, permissionContext)) {
    return false
  }

  return visitKnownAncestors(item, permissionContext.getItemById, (ancestor) =>
    actorHasResourcePermission(ancestor, PERMISSION_LEVEL.VIEW, permissionContext),
  )
}

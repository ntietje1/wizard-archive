import type { SidebarItemId } from '../../../../../shared/common/ids'
import { hasAtLeastPermissionLevel } from '../../../../../shared/permissions/hasAtLeastPermissionLevel'
import { normalizeExplicitSharePermissionLevel } from '../../../../../shared/permissions/share-permissions'
import { PERMISSION_LEVEL } from '../../../../../shared/permissions/types'
import type { PermissionLevel } from '../../../../../shared/permissions/types'
import type { EditorShareParticipantId } from '../../sharing/contracts'
import type { AnyItem, FolderItem } from '../../workspace/items'
import { RESOURCE_TYPES } from '../../workspace/items-persistence-contract'

export type EditorWorkspaceActor =
  | { kind: 'owner' }
  | { kind: 'participant' }
  | { kind: 'owner_view_as'; participantId: EditorShareParticipantId }

export interface ResourcePermissionContext {
  actor: EditorWorkspaceActor | null
  getItemById: (itemId: SidebarItemId) => AnyItem | null | undefined
}

function getMemberPermission(
  item: AnyItem | FolderItem,
  participantId: EditorShareParticipantId,
): PermissionLevel | null {
  const memberShare = item.shares.find((s) => s.campaignMemberId === participantId)
  return memberShare ? normalizeExplicitSharePermissionLevel(memberShare.permissionLevel) : null
}

function getAllPlayersPermission(item: AnyItem | FolderItem): PermissionLevel | null {
  return item.allPermissionLevel ?? null
}

function resolveInheritedPermission(
  item: AnyItem,
  participantId: EditorShareParticipantId,
  getItemById: ResourcePermissionContext['getItemById'],
): { level: PermissionLevel; source: string } | null {
  let currentParentId = item.parentId
  const seen = new Set<SidebarItemId>()

  while (currentParentId) {
    if (seen.has(currentParentId)) return null
    seen.add(currentParentId)

    const folder = getItemById(currentParentId) as FolderItem | undefined
    if (!folder) return null
    currentParentId = folder.parentId

    if (folder.type !== RESOURCE_TYPES.folders) continue
    if (!folder.inheritShares) return null

    const memberPermission = getMemberPermission(folder, participantId)
    if (memberPermission !== null) return { level: memberPermission, source: folder.name }

    const allPlayersPermission = getAllPlayersPermission(folder)
    if (allPlayersPermission !== null) {
      return { level: allPlayersPermission, source: folder.name }
    }
  }

  return null
}

function resolveResourcePermissionLevel(
  item: AnyItem,
  participantId: EditorShareParticipantId,
  getItemById: ResourcePermissionContext['getItemById'],
): { level: PermissionLevel; source?: string } {
  const memberPermission = getMemberPermission(item, participantId)
  if (memberPermission !== null) return { level: memberPermission }

  const allPlayersPermission = getAllPlayersPermission(item)
  if (allPlayersPermission !== null) return { level: allPlayersPermission }

  return (
    resolveInheritedPermission(item, participantId, getItemById) ?? { level: PERMISSION_LEVEL.NONE }
  )
}

function getActorResourcePermissionLevel(
  item: AnyItem,
  opts: ResourcePermissionContext,
): PermissionLevel {
  if (opts.actor?.kind === 'owner') return PERMISSION_LEVEL.FULL_ACCESS
  if (opts.actor?.kind === 'owner_view_as') {
    return resolveResourcePermissionLevel(item, opts.actor.participantId, opts.getItemById).level
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
  participantId: EditorShareParticipantId,
  getItemById: ResourcePermissionContext['getItemById'],
): PermissionLevel {
  return resolveResourcePermissionLevel(item, participantId, getItemById).level
}

export function canViewResourceAndKnownAncestors(
  item: AnyItem,
  permissionContext: ResourcePermissionContext,
): boolean {
  if (!actorHasResourcePermission(item, PERMISSION_LEVEL.VIEW, permissionContext)) {
    return false
  }

  let parentId = item.parentId
  const seen = new Set<SidebarItemId>()
  while (parentId) {
    if (seen.has(parentId)) return false
    seen.add(parentId)
    const parent = permissionContext.getItemById(parentId)
    if (!parent) return false
    if (!actorHasResourcePermission(parent, PERMISSION_LEVEL.VIEW, permissionContext)) {
      return false
    }
    parentId = parent.parentId
  }
  return true
}

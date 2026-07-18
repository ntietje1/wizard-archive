import type { CampaignMemberId, ResourceId } from './domain-id'

export const RESOURCE_PERMISSION = {
  none: 'none',
  view: 'view',
  edit: 'edit',
} as const

export type ResourcePermission = (typeof RESOURCE_PERMISSION)[keyof typeof RESOURCE_PERMISSION]
export type GrantedResourcePermission = Exclude<ResourcePermission, 'none'>

export const MAX_RESOURCE_ACCESS_COMMAND_RESOURCES = 64

export const FOLDER_ACCESS_INHERITANCE = {
  disabled: 'disabled',
  enabled: 'enabled',
} as const

export type FolderAccessInheritance =
  (typeof FOLDER_ACCESS_INHERITANCE)[keyof typeof FOLDER_ACCESS_INHERITANCE]

export type ResourceAccessDefaults = Readonly<{
  folderInheritance: FolderAccessInheritance
}>

export const DEFAULT_RESOURCE_ACCESS_DEFAULTS: ResourceAccessDefaults = {
  folderInheritance: FOLDER_ACCESS_INHERITANCE.disabled,
}

export type ResourceAccessPolicy =
  | Readonly<{
      resourceId: ResourceId
      audienceAccess: ResourceAudienceAccess
      subject: 'folder'
      inheritance: FolderAccessInheritance
    }>
  | Readonly<{
      resourceId: ResourceId
      audienceAccess: ResourceAudienceAccess
      subject: 'resource'
    }>

export type ResourceAudienceAccess =
  | Readonly<{ state: 'default' }>
  | Readonly<{ state: 'explicit'; permission: ResourcePermission }>

export type ResourceMemberAccess = Readonly<{
  resourceId: ResourceId
  memberId: CampaignMemberId
  permission: ResourcePermission
}>

export type ResourceAccessNode = Readonly<{
  policy: ResourceAccessPolicy
  parentId: ResourceId | null
  memberAccess:
    | Readonly<{ state: 'default' }>
    | Readonly<{ state: 'explicit'; permission: ResourcePermission }>
}>

export type ResourceAccessResolution = Readonly<{
  permission: ResourcePermission
  source:
    | Readonly<{
        type: 'audience' | 'member'
        resourceId: ResourceId
      }>
    | Readonly<{ type: 'none' }>
}>

export type ResourceAccessParticipant = Readonly<{
  id: CampaignMemberId
  displayName: string
  username: string
  imageUrl: string | null
  access: ResourceAccessNode['memberAccess']
  effectiveAccess: ResourceAccessResolution
}>

export type ResourceAccessPresentation = Readonly<{
  policy: ResourceAccessPolicy
  defaultAccess: ResourceAccessResolution
  participants: ReadonlyArray<ResourceAccessParticipant>
}>

const PERMISSION_RANK: Readonly<Record<ResourcePermission, number>> = {
  none: 0,
  view: 1,
  edit: 2,
}

export function resourcePermissionAllows(
  permission: ResourcePermission,
  required: GrantedResourcePermission,
): boolean {
  return PERMISSION_RANK[permission] >= PERMISSION_RANK[required]
}

export function resolveResourcePermission(
  resourceId: ResourceId,
  nodes: ReadonlyMap<ResourceId, ResourceAccessNode>,
): ResourcePermission {
  return resolveResourceAccess(resourceId, nodes).permission
}

export function resolveResourceAccess(
  resourceId: ResourceId,
  nodes: ReadonlyMap<ResourceId, ResourceAccessNode>,
): ResourceAccessResolution {
  const resource = nodes.get(resourceId)
  if (!resource) return noAccess()
  const direct = explicitOrAudienceAccess(resource)
  if (direct !== null) {
    return direct
  }

  const visited = new Set<ResourceId>([resourceId])
  let parentId = resource.parentId
  while (parentId !== null) {
    if (visited.has(parentId)) return noAccess()
    visited.add(parentId)
    const parent = nodes.get(parentId)
    if (
      !parent ||
      parent.policy.subject !== 'folder' ||
      parent.policy.inheritance === FOLDER_ACCESS_INHERITANCE.disabled
    ) {
      return noAccess()
    }
    const inherited = explicitOrAudienceAccess(parent)
    if (inherited !== null) {
      return inherited
    }
    parentId = parent.parentId
  }
  return noAccess()
}

export function canProjectResource(
  resourceId: ResourceId,
  nodes: ReadonlyMap<ResourceId, ResourceAccessNode>,
): boolean {
  const visited = new Set<ResourceId>()
  let currentId: ResourceId | null = resourceId
  while (currentId !== null) {
    if (visited.has(currentId)) return false
    visited.add(currentId)
    const current = nodes.get(currentId)
    if (
      !current ||
      !resourcePermissionAllows(
        resolveResourcePermission(currentId, nodes),
        RESOURCE_PERMISSION.view,
      )
    ) {
      return false
    }
    currentId = current.parentId
  }
  return true
}

function explicitOrAudienceAccess(node: ResourceAccessNode): ResourceAccessResolution | null {
  if (node.memberAccess.state === 'explicit') {
    return {
      permission: node.memberAccess.permission,
      source: { type: 'member', resourceId: node.policy.resourceId },
    }
  }
  return node.policy.audienceAccess.state === 'explicit'
    ? {
        permission: node.policy.audienceAccess.permission,
        source: { type: 'audience', resourceId: node.policy.resourceId },
      }
    : null
}

function noAccess(): ResourceAccessResolution {
  return { permission: RESOURCE_PERMISSION.none, source: { type: 'none' } }
}

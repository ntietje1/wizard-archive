import type { CampaignMemberId, ResourceId } from './domain-id'

export const RESOURCE_PERMISSION = {
  none: 'none',
  view: 'view',
  edit: 'edit',
} as const

export type ResourcePermission = (typeof RESOURCE_PERMISSION)[keyof typeof RESOURCE_PERMISSION]
export type GrantedResourcePermission = Exclude<ResourcePermission, 'none'>

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
      audiencePermission: ResourcePermission
      subject: 'folder'
      inheritance: FolderAccessInheritance
    }>
  | Readonly<{
      resourceId: ResourceId
      audiencePermission: ResourcePermission
      subject: 'resource'
    }>

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
  const resource = nodes.get(resourceId)
  if (!resource) return RESOURCE_PERMISSION.none
  const direct = explicitOrAudiencePermission(resource)
  if (direct !== RESOURCE_PERMISSION.none || resource.memberAccess.state === 'explicit') {
    return direct
  }

  const visited = new Set<ResourceId>([resourceId])
  let parentId = resource.parentId
  while (parentId !== null) {
    if (visited.has(parentId)) return RESOURCE_PERMISSION.none
    visited.add(parentId)
    const parent = nodes.get(parentId)
    if (
      !parent ||
      parent.policy.subject !== 'folder' ||
      parent.policy.inheritance === FOLDER_ACCESS_INHERITANCE.disabled
    ) {
      return RESOURCE_PERMISSION.none
    }
    const inherited = explicitOrAudiencePermission(parent)
    if (inherited !== RESOURCE_PERMISSION.none || parent.memberAccess.state === 'explicit') {
      return inherited
    }
    parentId = parent.parentId
  }
  return RESOURCE_PERMISSION.none
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

function explicitOrAudiencePermission(node: ResourceAccessNode): ResourcePermission {
  return node.memberAccess.state === 'explicit'
    ? node.memberAccess.permission
    : node.policy.audiencePermission
}

import { isPromiseLike } from '../../../../shared/common/async'
import type { MaybePromise } from '../../../../shared/common/async'
import type { BrandedString } from '../../../../shared/branded'
import type { PermissionLevel } from '../../../../shared/permissions/types'
import type { CanvasItem, CanvasItemRow, CanvasItemWithContent } from '../canvas/item-contract'
import type { FileItem, FileItemRow, FileItemWithContent } from '../files/item-contract'
import type {
  MapItem,
  MapItemRow,
  MapItemWithContent as MapItemWithContentContract,
} from '../game-maps/item-contract'
import type { NoteItem, NoteItemRow, NoteItemWithContent } from '../notes/item-contract'
import { RESOURCE_ICON_NAMES, RESOURCE_STATUS } from './items-persistence-contract'
import type { RESOURCE_TYPES } from './items-persistence-contract'
import type {
  AssetId,
  CampaignId,
  CampaignMemberId,
  ResourceId,
  ResourceShareId,
  SessionId,
} from './domain-id'
import { isUuidV7 } from './domain-id'
import type { ResourceTitle } from './resource-record'
export type ResourceKind = (typeof RESOURCE_TYPES)[keyof typeof RESOURCE_TYPES]
export type ResourceStatus = (typeof RESOURCE_STATUS)[keyof typeof RESOURCE_STATUS]
export type ResourceLocation = 'sidebar'
export type ResourceIconName = (typeof RESOURCE_ICON_NAMES)[number]
export type ResourceColor = BrandedString<'ResourceColor'>

export type ResourceValidationResult = { valid: true } | { valid: false; error: string }

export function isActiveResource(resource: { status: ResourceStatus }): boolean {
  return resource.status === RESOURCE_STATUS.active
}

export function isPersistedResourceId(
  resourceId: string | null | undefined,
): resourceId is ResourceId {
  return typeof resourceId === 'string' && isUuidV7(resourceId)
}

type ResourceReadModelResource = {
  id: ResourceId
  parentId: ResourceId | null
  status: ResourceStatus
}

function createReadonlyResourceArray<T>(items: Iterable<T>): ReadonlyArray<T> {
  return Object.freeze(Array.from(items))
}

function createReadonlyResourceMap<K, V>(entries: ReadonlyMap<K, V>): ReadonlyMap<K, V> {
  const map = new Map(entries)
  return new Proxy(map, {
    get(target, property) {
      if (property === 'set' || property === 'delete' || property === 'clear') {
        return () => {
          throw new TypeError('Resource read model maps are readonly')
        }
      }

      const value = Reflect.get(target, property, target)
      return typeof value === 'function' ? value.bind(target) : value
    },
  }) as ReadonlyMap<K, V>
}

export type ResourceReadModel<T extends ResourceReadModelResource> = {
  resources: ReadonlyArray<T>
  resourcesById: ReadonlyMap<ResourceId, T>
  activeChildrenByParent: ReadonlyMap<ResourceId | null, ReadonlyArray<T>>
  getResource: (resourceId: ResourceId) => T | undefined
  getResources: (resourceIds: Array<ResourceId>) => Array<T>
  requireResources: (resourceIds: Array<ResourceId>) => Array<T>
  getActiveAncestors: (resourceId: ResourceId) => Array<T>
  getActiveChildren: (parentId: ResourceId | null) => Array<T>
}

export function createResourceReadModel<T extends ResourceReadModelResource>(
  resources: Array<T>,
): ResourceReadModel<T> {
  const indexedResources = [...resources]
  const resourcesById = new Map<ResourceId, T>()
  const activeChildrenByParent = new Map<ResourceId | null, Array<T>>()

  for (const resource of indexedResources) {
    if (resourcesById.has(resource.id)) throw new Error(`Duplicate resource id: ${resource.id}`)
    resourcesById.set(resource.id, resource)
    if (isActiveResource(resource)) {
      const children = activeChildrenByParent.get(resource.parentId)
      if (children) {
        children.push(resource)
      } else {
        activeChildrenByParent.set(resource.parentId, [resource])
      }
    }
  }
  const exposedActiveChildrenByParent = new Map<ResourceId | null, ReadonlyArray<T>>(
    Array.from(activeChildrenByParent, ([parentId, children]) => [
      parentId,
      createReadonlyResourceArray(children),
    ]),
  )

  return {
    activeChildrenByParent: createReadonlyResourceMap(exposedActiveChildrenByParent),
    resources: createReadonlyResourceArray(indexedResources),
    resourcesById: createReadonlyResourceMap(resourcesById),
    getResource: (resourceId) => resourcesById.get(resourceId),
    getResources: (resourceIds) =>
      resourceIds
        .map((resourceId) => resourcesById.get(resourceId))
        .filter((resource): resource is T => Boolean(resource)),
    requireResources: (resourceIds) => {
      const resolved = resourceIds.map((resourceId) => resourcesById.get(resourceId))
      const missing = resourceIds.filter((_, index) => !resolved[index])
      if (missing.length > 0) {
        throw new Error(`Resource read model is missing resources: ${missing.join(', ')}`)
      }
      return resolved as Array<T>
    },
    getActiveAncestors: (resourceId) => {
      const resource = resourcesById.get(resourceId)
      if (!resource) return []
      const ancestors: Array<T> = []
      const seen = new Set<ResourceId>()
      let currentParentId = resource.parentId
      while (currentParentId && !seen.has(currentParentId)) {
        seen.add(currentParentId)
        const ancestor = resourcesById.get(currentParentId)
        if (!ancestor || !isActiveResource(ancestor)) break
        ancestors.push(ancestor)
        currentParentId = ancestor.parentId
      }
      return ancestors
    },
    getActiveChildren: (parentId) => [...(activeChildrenByParent.get(parentId) ?? [])],
  }
}

const RESOURCE_HEX_COLOR_REGEX = /^#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/

function validateResourceColor(color: string): string | null {
  return RESOURCE_HEX_COLOR_REGEX.test(color) ? null : 'Color must be a 6- or 8-digit hex value'
}

function parseResourceColor(color: string): ResourceColor | null {
  return validateResourceColor(color) === null ? (color.toLowerCase() as ResourceColor) : null
}

export function assertResourceColor(color: string): ResourceColor {
  const parsed = parseResourceColor(color)
  if (!parsed) {
    throw new Error(validateResourceColor(color) ?? 'Invalid color')
  }
  return parsed
}

export function assertResourceIconName(iconName: string): ResourceIconName {
  if (!RESOURCE_ICON_NAMES.includes(iconName as ResourceIconName)) {
    throw new Error('Icon is not supported')
  }
  return iconName as ResourceIconName
}

type ResourceNormalizedFields = {
  name: ResourceTitle
  iconName: ResourceIconName | null
  color: ResourceColor | null
}

export type ResourceShare = {
  id: ResourceShareId
  createdAt: number
  campaignId: CampaignId
  sidebarItemId: ResourceId
  sidebarItemType: ResourceKind
  campaignMemberId: CampaignMemberId
  sessionId: SessionId | null
  permissionLevel: PermissionLevel | null
}

type ResourcePersistedStringFields = {
  name: string
  iconName: string | null
  color: string | null
}

type ResourceEnhancementFields = {
  shares: Array<ResourceShare>
  isBookmarked: boolean
  myPermissionLevel: PermissionLevel
  previewUrl: string | null
  isActive: boolean
  isTrashed: boolean
}

type NormalizeResource<T extends ResourcePersistedStringFields> = Omit<
  T,
  keyof ResourceNormalizedFields
> &
  ResourceNormalizedFields

type EnhanceResource<T extends ResourcePersistedStringFields> = NormalizeResource<T> &
  ResourceEnhancementFields

export type ResourceRow<T extends ResourceKind = ResourceKind> = {
  id: ResourceId
  createdAt: number
  name: string
  iconName: string | null
  color: string | null
  campaignId: CampaignId
  parentId: ResourceId | null
  type: T
  allPermissionLevel: PermissionLevel | null
  location: ResourceLocation
  status: ResourceStatus
  previewAssetId: AssetId | null
  updatedTime: number | null
  updatedBy: CampaignMemberId | null
  createdBy: CampaignMemberId
  deletionTime: number | null
  deletedBy: CampaignMemberId | null
}

export type BaseResourceRow<T extends ResourceKind = ResourceKind> = ResourceRow<T>

export type BaseResource<T extends ResourceKind = ResourceKind> = EnhanceResource<
  BaseResourceRow<T>
>

export type FolderResource = BaseResource<typeof RESOURCE_TYPES.folders> & {
  inheritShares: boolean
}

export type FolderResourceRow = BaseResourceRow<typeof RESOURCE_TYPES.folders> & {
  inheritShares: boolean
}

type FolderResourceAncestor = BaseResource<typeof RESOURCE_TYPES.folders> & {
  inheritShares: boolean
}

export type BaseResourceWithContent<T extends ResourceKind = ResourceKind> = BaseResource<T> & {
  ancestors: Array<FolderResourceAncestor>
}

export type FolderResourceWithContent = BaseResourceWithContent<typeof RESOURCE_TYPES.folders> & {
  inheritShares: boolean
}

export const RESOURCE_PARENT_TARGET_KIND = {
  direct: 'direct',
  path: 'path',
} as const

export type ResourceParentTarget =
  | {
      kind: typeof RESOURCE_PARENT_TARGET_KIND.direct
      parentId: ResourceId | null
    }
  | {
      kind: typeof RESOURCE_PARENT_TARGET_KIND.path
      baseParentId: ResourceId | null
      pathSegments: Array<string>
    }

type ResourceParentLookup<TId extends string> = { parentId: TId | null } | null | undefined

function validateNoCircularResourceParentInternal<TId extends string>(
  resourceId: TId,
  newParentId: TId | null,
  getParent: (id: TId) => MaybePromise<ResourceParentLookup<TId>>,
): MaybePromise<ResourceValidationResult> {
  if (!newParentId) {
    return { valid: true }
  }

  if (newParentId === resourceId) {
    return {
      valid: false,
      error: 'An item cannot be its own parent',
    }
  }

  const seen = new Set<TId>()

  const visit = (currentId: TId | null): MaybePromise<ResourceValidationResult> => {
    if (!currentId) {
      return { valid: true }
    }

    if (seen.has(currentId)) {
      return {
        valid: false,
        error: 'This move would create a circular reference',
      }
    }
    seen.add(currentId)

    if (currentId === resourceId) {
      return {
        valid: false,
        error: 'This move would create a circular reference',
      }
    }

    const current = getParent(currentId)
    if (isPromiseLike(current)) {
      return current.then((value) => visit(value?.parentId ?? null))
    }

    return visit(current?.parentId ?? null)
  }

  return visit(newParentId)
}

export async function validateNoCircularResourceParentAsync<TId extends string = ResourceId>(
  resourceId: TId,
  newParentId: TId | null,
  getParent: (id: TId) => MaybePromise<ResourceParentLookup<TId>>,
): Promise<ResourceValidationResult> {
  return await validateNoCircularResourceParentInternal(resourceId, newParentId, getParent)
}

type CompleteResourceKindMap<T extends Record<ResourceKind, unknown>> = T

type RowByKind = CompleteResourceKindMap<{
  [RESOURCE_TYPES.notes]: ResourceRow<typeof RESOURCE_TYPES.notes>
  [RESOURCE_TYPES.folders]: ResourceRow<typeof RESOURCE_TYPES.folders>
  [RESOURCE_TYPES.gameMaps]: ResourceRow<typeof RESOURCE_TYPES.gameMaps>
  [RESOURCE_TYPES.files]: ResourceRow<typeof RESOURCE_TYPES.files>
  [RESOURCE_TYPES.canvases]: ResourceRow<typeof RESOURCE_TYPES.canvases>
}>

type ResourceRowByKindMap = CompleteResourceKindMap<{
  [RESOURCE_TYPES.notes]: NoteItemRow
  [RESOURCE_TYPES.folders]: FolderResourceRow
  [RESOURCE_TYPES.gameMaps]: MapItemRow
  [RESOURCE_TYPES.files]: FileItemRow
  [RESOURCE_TYPES.canvases]: CanvasItemRow
}>

type EnhancedByKind = CompleteResourceKindMap<{
  [RESOURCE_TYPES.notes]: NoteItem
  [RESOURCE_TYPES.folders]: FolderResource
  [RESOURCE_TYPES.gameMaps]: MapItem
  [RESOURCE_TYPES.files]: FileItem
  [RESOURCE_TYPES.canvases]: CanvasItem
}>

type WithContentByKind = CompleteResourceKindMap<{
  [RESOURCE_TYPES.notes]: NoteItemWithContent
  [RESOURCE_TYPES.folders]: FolderResourceWithContent
  [RESOURCE_TYPES.gameMaps]: MapItemWithContentContract<EnhancedByKind[ResourceKind]>
  [RESOURCE_TYPES.files]: FileItemWithContent
  [RESOURCE_TYPES.canvases]: CanvasItemWithContent
}>

export type AnyResourceBaseRow = RowByKind[ResourceKind]
export type AnyResourceRow = ResourceRowByKindMap[ResourceKind]
export type AnyResource = EnhancedByKind[ResourceKind]
export type AnyResourceWithContent = WithContentByKind[ResourceKind]

export type ResourceRowByKind<T extends ResourceKind> = ResourceRowByKindMap[T]
export type ResourceByKind<T extends ResourceKind> = EnhancedByKind[T]
export type ResourceWithContentByKind<T extends ResourceKind> = WithContentByKind[T]

export type EnhancedResource<T extends AnyResourceRow> = ResourceByKind<T['type']>
export type WithContentResource<T extends AnyResource> = ResourceWithContentByKind<T['type']>

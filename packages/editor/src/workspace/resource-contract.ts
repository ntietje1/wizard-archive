import { isPromiseLike } from '../../../../shared/common/async'
import type { MaybePromise } from '../../../../shared/common/async'
import type { UserProfileId } from '../../../../shared/common/ids'
import { brandString } from '../../../../shared/branded'
import type { BrandedString } from '../../../../shared/branded'
import { parseSlug, validateSlug } from '../../../../shared/slugs'
import type { PermissionLevel } from '../../../../shared/permissions/types'
import type { CanvasItem, CanvasItemRow, CanvasItemWithContent } from '../canvas/item-contract'
import type { FileItem, FileItemRow, FileItemWithContent } from '../files/item-contract'
import type {
  MapItem,
  MapItemRow,
  MapItemWithContent as MapItemWithContentContract,
} from '../game-maps/item-contract'
import type { NoteItem, NoteItemRow, NoteItemWithContent } from '../notes/item-contract'
import { isOptimisticSidebarItemId } from './items/optimistic'
import { RESOURCE_ICON_NAMES, RESOURCE_STATUS } from './items-persistence-contract'
import type { RESOURCE_TYPES } from './items-persistence-contract'
import type {
  AssetId,
  CampaignId,
  CampaignMemberId,
  ResourceShareId,
  SessionId,
} from '../resources/domain-id'
import type { ResourceTitle } from '../resources/resource-contract'

type ResourceTableId<TableName extends string> = string & { __tableName: TableName }

export type ResourceId = ResourceTableId<'sidebarItems'>
export type ResourceKind = (typeof RESOURCE_TYPES)[keyof typeof RESOURCE_TYPES]
export type ResourceStatus = (typeof RESOURCE_STATUS)[keyof typeof RESOURCE_STATUS]
export type ResourceLocation = 'sidebar'
export type ResourceIconName = (typeof RESOURCE_ICON_NAMES)[number]
export type ResourceSlug = BrandedString<'ResourceSlug'>
export type ResourceColor = BrandedString<'ResourceColor'>

export type ResourceValidationResult = { valid: true } | { valid: false; error: string }

export function isActiveResource(resource: { status: ResourceStatus }): boolean {
  return resource.status === RESOURCE_STATUS.active
}

export function isPersistedResourceId(resourceId: string | null | undefined): resourceId is string {
  return (
    typeof resourceId === 'string' &&
    resourceId.length > 0 &&
    !isOptimisticSidebarItemId(resourceId)
  )
}

type ResourceReadModelResource = {
  id: ResourceId
  slug?: string
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
  resourcesBySlug: ReadonlyMap<ResourceSlug, T>
  activeChildrenByParent: ReadonlyMap<ResourceId | null, ReadonlyArray<T>>
  getResource: (resourceId: ResourceId) => T | undefined
  getResources: (resourceIds: Array<ResourceId>) => Array<T>
  requireResources: (resourceIds: Array<ResourceId>) => Array<T>
  getResourceBySlug: (slug: ResourceSlug) => T | undefined
  getActiveAncestors: (resourceId: ResourceId) => Array<T>
  getActiveChildren: (parentId: ResourceId | null) => Array<T>
}

export function createResourceReadModel<T extends ResourceReadModelResource>(
  resources: Array<T>,
): ResourceReadModel<T> {
  const indexedResources = [...resources]
  const resourcesById = new Map<ResourceId, T>()
  const resourcesBySlug = new Map<ResourceSlug, T>()
  const activeChildrenByParent = new Map<ResourceId | null, Array<T>>()

  for (const resource of indexedResources) {
    if (resourcesById.has(resource.id)) throw new Error(`Duplicate resource id: ${resource.id}`)
    resourcesById.set(resource.id, resource)
    if (resource.slug) {
      const slug = assertResourceSlug(resource.slug)
      const existing = resourcesBySlug.get(slug)
      if (existing) {
        throw new Error(`Duplicate resource slug: ${slug} (${existing.id} and ${resource.id})`)
      }
      resourcesBySlug.set(slug, resource)
    }
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
    resourcesBySlug: createReadonlyResourceMap(resourcesBySlug),
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
    getResourceBySlug: (slug) => resourcesBySlug.get(slug),
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

export const RESOURCE_SLUG_MAX_LENGTH = 255

const RESOURCE_SLUG_OPTIONS = {
  label: 'Slug',
  maxLength: RESOURCE_SLUG_MAX_LENGTH,
} as const

function validateResourceSlug(value: string): string | null {
  return validateSlug(value, RESOURCE_SLUG_OPTIONS)
}

export function parseResourceSlug(value: string): ResourceSlug | null {
  const parsed = parseSlug(value, RESOURCE_SLUG_OPTIONS)
  return parsed ? brandString<'ResourceSlug'>(parsed) : null
}

export function assertResourceSlug(value: string): ResourceSlug {
  const parsed = parseResourceSlug(value)
  if (!parsed) {
    throw new Error(validateResourceSlug(value) ?? 'Invalid slug')
  }
  return parsed
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
  slug: ResourceSlug
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
  slug: string
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
  slug: string
  campaignId: CampaignId
  parentId: ResourceId | null
  type: T
  allPermissionLevel: PermissionLevel | null
  location: ResourceLocation
  status: ResourceStatus
  previewAssetId: AssetId | null
  updatedTime: number | null
  updatedBy: UserProfileId | null
  createdBy: UserProfileId
  deletionTime: number | null
  deletedBy: UserProfileId | null
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

type ResourceParentLookup = { parentId: ResourceId | null } | null | undefined

function validateNoCircularResourceParentInternal(
  resourceId: ResourceId,
  newParentId: ResourceId | null,
  getParent: (id: ResourceId) => MaybePromise<ResourceParentLookup>,
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

  const seen = new Set<ResourceId>()

  const visit = (currentId: ResourceId | null): MaybePromise<ResourceValidationResult> => {
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

export async function validateNoCircularResourceParentAsync(
  resourceId: ResourceId,
  newParentId: ResourceId | null,
  getParent: (id: ResourceId) => MaybePromise<ResourceParentLookup>,
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

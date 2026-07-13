import { isPromiseLike } from '../../../../shared/common/async'
import type { MaybePromise } from '../../../../shared/common/async'
import type {
  CampaignMemberId,
  SessionRowId,
  AssetId,
  UserProfileId,
} from '../../../../shared/common/ids'
import { brandString } from '../../../../shared/branded'
import type { BrandedString } from '../../../../shared/branded'
import { parseSlug, slugify, validateSlug } from '../../../../shared/slugs'
import type { PermissionLevel } from '../../../../shared/permissions/types'
import type { CanvasItem, CanvasItemRow, CanvasItemWithContent } from '../canvas/item-contract'
import type { FileItem, FileItemRow, FileItemWithContent } from '../files/item-contract'
import type {
  MapItem,
  MapItemRow,
  MapItemWithContent as MapItemWithContentContract,
} from '../game-maps/item-contract'
import type { NoteItem, NoteItemRow, NoteItemWithContent } from '../notes/item-contract'
import { deduplicateNumericSuffix } from './items/deduplicate-numeric-suffix'
import { isOptimisticSidebarItemId } from './items/optimistic'
import { RESOURCE_ICON_NAMES, RESOURCE_STATUS } from './items-persistence-contract'
import type { RESOURCE_TYPES } from './items-persistence-contract'

type ResourceTableId<TableName extends string> = string & { __tableName: TableName }

export type ResourceId = ResourceTableId<'sidebarItems'>
export type ResourceShareId = ResourceTableId<'sidebarItemShares'>
export type ResourceTransactionId = ResourceTableId<'filesystemTransactions'>
export type ResourceKind = (typeof RESOURCE_TYPES)[keyof typeof RESOURCE_TYPES]
export type ResourceStatus = (typeof RESOURCE_STATUS)[keyof typeof RESOURCE_STATUS]
export type ResourceLocation = 'sidebar'
export type ResourceIconName = (typeof RESOURCE_ICON_NAMES)[number]
export type ResourceName = BrandedString<'ResourceName'>
export type ResourceSlug = BrandedString<'ResourceSlug'>
export type ResourceColor = BrandedString<'ResourceColor'>
export type ResourceWorkspaceId = ResourceTableId<'campaigns'>

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

const RESOURCE_NAME_MAX_LENGTH = 255
const RESOURCE_FORBIDDEN_NAME_CHARS = /[/\\:*?"<>[\]#|]/
const RESOURCE_FORBIDDEN_NAME_CHARS_DISPLAY = '/ \\ : * ? " < > [ ] # |'

function hasResourceControlChars(value: string): boolean {
  for (const char of value) {
    const codePoint = char.codePointAt(0)
    if (
      codePoint !== undefined &&
      (codePoint <= 0x1f || (codePoint >= 0x7f && codePoint <= 0x9f))
    ) {
      return true
    }
  }

  return false
}

export function validateResourceName(name: string): ResourceValidationResult {
  if (name.trim().length === 0) {
    return { valid: false, error: 'Name is required' }
  }
  if (name !== name.trim()) {
    return { valid: false, error: 'Name cannot start or end with whitespace' }
  }
  if (name.length > RESOURCE_NAME_MAX_LENGTH) {
    return {
      valid: false,
      error: `Name must be ${RESOURCE_NAME_MAX_LENGTH} characters or fewer`,
    }
  }
  if (RESOURCE_FORBIDDEN_NAME_CHARS.test(name)) {
    return {
      valid: false,
      error: `Name cannot contain any of: ${RESOURCE_FORBIDDEN_NAME_CHARS_DISPLAY}`,
    }
  }
  if (hasResourceControlChars(name)) {
    return { valid: false, error: 'Name cannot contain control characters' }
  }
  if (name.startsWith('.') || name.endsWith('.')) {
    return { valid: false, error: 'Name cannot start or end with a dot' }
  }
  if (slugify(name).length === 0) {
    return { valid: false, error: 'Name must contain at least one letter or number' }
  }
  return { valid: true }
}

function parseResourceName(name: string): ResourceName | null {
  return validateResourceName(name).valid ? (name as ResourceName) : null
}

export function assertResourceName(name: string): ResourceName {
  const result = validateResourceName(name)
  if (!result.valid) {
    throw new Error(result.error)
  }

  const parsed = parseResourceName(name)
  if (!parsed) {
    throw new Error('Validated resource name could not be parsed')
  }

  return parsed
}

export function normalizeResourceNameForComparison(name: string): string {
  return name.trim().toLowerCase()
}

export function checkResourceNameConflict<TId extends string = string>(
  name: string,
  siblings: ReadonlyArray<{ id: TId; name: string }>,
  excludeId?: TId,
): ResourceValidationResult {
  const normalizedName = normalizeResourceNameForComparison(name)
  const conflict = siblings.find(
    (resource) =>
      normalizeResourceNameForComparison(resource.name) === normalizedName &&
      resource.id !== excludeId,
  )

  if (conflict) {
    return {
      valid: false,
      error: 'An item with this name already exists here',
    }
  }
  return { valid: true }
}

export function validateResourceNameWithSiblings<TId extends string = string>(
  name: string,
  siblings?: ReadonlyArray<{ id: TId; name: string }>,
  excludeId?: TId,
): ResourceValidationResult {
  const nameResult = validateResourceName(name)
  if (!nameResult.valid) {
    return nameResult
  }

  if (!siblings) {
    return { valid: true }
  }

  return checkResourceNameConflict(name, siblings, excludeId)
}

export function deduplicateResourceName(base: string, siblingNames: Array<string>): string {
  const normalizedBase = base.trimEnd()
  return deduplicateNumericSuffix(normalizedBase, siblingNames, {
    separator: ' ',
    normalize: (value) => value.toLowerCase(),
    maxLength: RESOURCE_NAME_MAX_LENGTH,
    errorLabel: 'resource name',
  })
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
  name: ResourceName
  iconName: ResourceIconName | null
  color: ResourceColor | null
  slug: ResourceSlug
}

export type ResourceShare = {
  id: ResourceShareId
  createdAt: number
  campaignId: ResourceWorkspaceId
  sidebarItemId: ResourceId
  sidebarItemType: ResourceKind
  campaignMemberId: CampaignMemberId
  sessionId: SessionRowId | null
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
  campaignId: ResourceWorkspaceId
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

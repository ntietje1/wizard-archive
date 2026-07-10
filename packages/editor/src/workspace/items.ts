import {
  assertResourceColor,
  assertResourceIconName,
  assertResourceName,
  assertResourceSlug,
  checkResourceNameConflict,
  createResourceReadModel,
  isActiveResource,
  normalizeResourceNameForComparison,
  parseResourceSlug,
  validateNoCircularResourceParentAsync,
  validateResourceName,
  validateResourceNameWithSiblings,
} from './resource-contract'
import type {
  BaseResource,
  BaseResourceRow,
  BaseResourceWithContent,
  EnhancedResource,
  ResourceByKind,
  ResourceColor,
  ResourceName,
  ResourceRow,
  ResourceRowByKind,
  ResourceReadModel,
  ResourceSlug,
  ResourceWithContentByKind,
  WithContentResource,
  ResourceStatus,
  ResourceKind,
  ResourceId,
} from './resource-contract'
import type { RESOURCE_TYPES } from './items-persistence-contract'
import { deduplicateNumericSuffix } from './items/deduplicate-numeric-suffix'
import { isOptimisticSidebarItem, isOptimisticSidebarItemId } from './items/optimistic'

export type FolderItem = ResourceByKind<typeof RESOURCE_TYPES.folders>
export type FolderItemRow = ResourceRowByKind<typeof RESOURCE_TYPES.folders>
export type FolderItemWithContent = ResourceWithContentByKind<typeof RESOURCE_TYPES.folders>

export function isActiveResourceItem(item: { status: ResourceStatus }): boolean {
  return isActiveResource(item)
}

export function isPersistedResourceItemId(itemId: string | null | undefined): itemId is string {
  return Boolean(itemId) && !isOptimisticSidebarItemId(itemId)
}

export function isPersistedResourceItem<Item extends Pick<AnyItem, 'id'>>(
  item: Item | null | undefined,
): item is Item {
  return Boolean(item) && !isOptimisticSidebarItem(item)
}

type WorkspaceResourceReadModelItem = {
  id: ResourceId
  slug?: string
  parentId: ResourceId | null
  status: ResourceStatus
}

export type WorkspaceResourceReadModel<T extends WorkspaceResourceReadModelItem> = {
  items: ReadonlyArray<T>
  itemsById: ReadonlyMap<ResourceId, T>
  itemsBySlug: ReadonlyMap<ResourceSlug, T>
  activeChildrenByParent: ReadonlyMap<ResourceId | null, ReadonlyArray<T>>
  getItem: (itemId: ResourceId) => T | undefined
  getItems: (itemIds: Array<ResourceId>) => Array<T>
  requireItems: (itemIds: Array<ResourceId>) => Array<T>
  getItemBySlug: (slug: ResourceSlug) => T | undefined
  getActiveAncestors: (itemId: ResourceId) => Array<T>
  getActiveChildren: (parentId: ResourceId | null) => Array<T>
}

export function createWorkspaceResourceReadModel<T extends WorkspaceResourceReadModelItem>(
  items: Array<T>,
): WorkspaceResourceReadModel<T> {
  const model = createResourceReadModel(items) as ResourceReadModel<T>

  return {
    activeChildrenByParent: model.activeChildrenByParent,
    items: model.resources,
    itemsById: model.resourcesById,
    itemsBySlug: model.resourcesBySlug as ReadonlyMap<ResourceSlug, T>,
    getItem: model.getResource,
    getItems: model.getResources,
    requireItems: model.requireResources,
    getItemBySlug: model.getResourceBySlug as (slug: ResourceSlug) => T | undefined,
    getActiveAncestors: model.getActiveAncestors,
    getActiveChildren: model.getActiveChildren,
  }
}

export type AnyItemBaseRow = ResourceRow<ResourceKind>
export type AnyItemRow = ResourceRowByKind<ResourceKind>
export type AnyItem = ResourceByKind<ResourceKind>
export type AnyItemWithContent = ResourceWithContentByKind<ResourceKind>

export function isResourceItemWithContent(
  item: AnyItem | null | undefined,
): item is AnyItemWithContent {
  return item !== null && item !== undefined && 'ancestors' in item && Array.isArray(item.ancestors)
}

export type ItemRowByResourceKind<T extends ResourceKind> = ResourceRowByKind<T>
export type ItemByResourceKind<T extends ResourceKind> = ResourceByKind<T>
export type WithContentByResourceKind<T extends ResourceKind> = ResourceWithContentByKind<T>

export type EnhancedResourceItem<T extends AnyItemRow> = EnhancedResource<T>
export type WithContentResourceItem<T extends AnyItem> = WithContentResource<T>

export type ValidationResult = { valid: true } | { valid: false; error: string }

export function validateItemName(name: string): ValidationResult {
  return validateResourceName(name)
}

export function assertResourceItemName(name: string): ResourceName {
  return assertResourceName(name)
}

export function normalizeResourceItemNameForComparison(name: string): string {
  return normalizeResourceNameForComparison(name)
}

export function checkNameConflict<TId extends string = string>(
  name: string,
  siblings: ReadonlyArray<{ id: TId; name: string }>,
  excludeId?: TId,
): ValidationResult {
  return checkResourceNameConflict(name, siblings, excludeId)
}

export function validateResourceItemNameWithSiblings<TId extends string = string>(
  name: string,
  siblings?: ReadonlyArray<{ id: TId; name: string }>,
  excludeId?: TId,
): ValidationResult {
  return validateResourceNameWithSiblings(name, siblings, excludeId)
}

export const RESOURCE_SLUG_MAX_LENGTH = 255

export function parseResourceItemSlug(value: string): ResourceSlug | null {
  return parseResourceSlug(value)
}

export function assertResourceItemSlug(value: string): ResourceSlug {
  return assertResourceSlug(value)
}

export function assertResourceItemColor(color: string): ResourceColor {
  return assertResourceColor(color)
}

export function assertResourceItemIconName(iconName: string) {
  return assertResourceIconName(iconName)
}

export function deduplicateName(base: string, siblingNames: Array<string>): string {
  const normalizedBase = base.trimEnd()
  return deduplicateNumericSuffix(normalizedBase, siblingNames, {
    separator: ' ',
    normalize: (value) => value.toLowerCase(),
    maxLength: RESOURCE_SLUG_MAX_LENGTH,
    errorLabel: 'sidebar item name',
  })
}

export const CREATE_PARENT_TARGET_KIND = {
  direct: 'direct',
  path: 'path',
} as const

export type CreateParentTarget =
  | {
      kind: typeof CREATE_PARENT_TARGET_KIND.direct
      parentId: ResourceId | null
    }
  | {
      kind: typeof CREATE_PARENT_TARGET_KIND.path
      baseParentId: ResourceId | null
      pathSegments: Array<string>
    }

export async function validateNoCircularParentAsync(
  itemId: ResourceId,
  newParentId: ResourceId | null,
  getParent: Parameters<typeof validateNoCircularResourceParentAsync>[2],
): Promise<ValidationResult> {
  return await validateNoCircularResourceParentAsync(itemId, newParentId, getParent)
}

export type BaseResourceItemRow<T extends ResourceKind = ResourceKind> = BaseResourceRow<T>
export type BaseResourceItem<T extends ResourceKind = ResourceKind> = BaseResource<T>
export type BaseResourceItemWithContent<T extends ResourceKind = ResourceKind> =
  BaseResourceWithContent<T>

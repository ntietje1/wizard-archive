import type { SidebarItemId } from '../../../../shared/common/ids'
import type { AnyItem } from '../workspace/items'
import type { ResourceSlug, ResourceKind } from '../workspace/resource-contract'

export interface FileSystemCatalogIndex {
  visibleItems: ReadonlyArray<AnyItem>
  visibleItemsById: ReadonlyMap<SidebarItemId, AnyItem>
  trashedItems: ReadonlyArray<AnyItem>
  visibleRoots: ReadonlyArray<AnyItem>
  trashRoots: ReadonlyArray<AnyItem>
  visibleChildrenByParent: ReadonlyMap<SidebarItemId | null, ReadonlyArray<AnyItem>>
  trashChildrenByParent: ReadonlyMap<SidebarItemId | null, ReadonlyArray<AnyItem>>
  getKnownItemById: (itemId: SidebarItemId) => AnyItem | null
  getKnownItemBySlug: (slug: ResourceSlug) => AnyItem | null
  getVisibleItemById: (itemId: SidebarItemId) => AnyItem | null
  getVisibleItemBySlug: (slug: ResourceSlug) => AnyItem | null
  getVisibleAncestors: (itemId: SidebarItemId) => ReadonlyArray<AnyItem>
  queryVisibleItems: (input?: FileSystemCatalogVisibleItemsInput) => ReadonlyArray<AnyItem>
}

export interface FileSystemCatalogVisibleItemsInput {
  parentId?: SidebarItemId | null
  type?: ResourceKind | ReadonlyArray<ResourceKind>
}

export function createFileSystemCatalogIndex({
  activeItems,
  trashItems,
  visibleActiveItems = activeItems,
}: {
  activeItems: Array<AnyItem>
  trashItems: Array<AnyItem>
  visibleActiveItems?: Array<AnyItem>
}): FileSystemCatalogIndex {
  const knownActiveItems = activeItems.map(snapshotCatalogItem)
  const knownActiveItemsById = new Map(knownActiveItems.map((item) => [item.id, item] as const))
  const rawVisibleItems = visibleActiveItems.map(
    (item) => knownActiveItemsById.get(item.id) ?? snapshotCatalogItem(item),
  )
  const rawVisibleItemsById = new Map(rawVisibleItems.map((item) => [item.id, item] as const))
  const visibleItems = rawVisibleItems.map((item) => {
    if (!item.parentId || rawVisibleItemsById.has(item.parentId)) return item
    return snapshotCatalogItem({ ...item, parentId: null } as AnyItem)
  })
  const visibleItemsById = new Map(visibleItems.map((item) => [item.id, item] as const))
  const trashedItems = trashItems.map(snapshotCatalogItem)
  const visibleRoots = visibleItems.filter(
    (item) => !item.parentId || !visibleItemsById.has(item.parentId),
  )
  const trashItemsById = new Map(trashedItems.map((item) => [item.id, item] as const))
  const knownItemsById = new Map<SidebarItemId, AnyItem>([
    ...trashItemsById,
    ...knownActiveItemsById,
  ])
  const knownItemsBySlug = new Map<ResourceSlug, AnyItem>([
    ...trashedItems.map((item) => [item.slug, item] as const),
    ...knownActiveItems.map((item) => [item.slug, item] as const),
  ])
  const visibleItemsBySlug = new Map(visibleItems.map((item) => [item.slug, item] as const))
  const trashRoots = trashedItems.filter(
    (item) => !item.parentId || !trashItemsById.has(item.parentId),
  )
  const visibleChildrenByParent = buildChildrenByParent(visibleItems, visibleItemsById)
  const trashChildrenByParent = buildChildrenByParent(trashedItems, trashItemsById)

  return {
    visibleItems,
    visibleItemsById,
    trashedItems,
    visibleRoots,
    trashRoots,
    visibleChildrenByParent,
    trashChildrenByParent,
    getKnownItemById: (itemId) => knownItemsById.get(itemId) ?? null,
    getKnownItemBySlug: (slug) => knownItemsBySlug.get(slug) ?? null,
    getVisibleItemById: (itemId) => visibleItemsById.get(itemId) ?? null,
    getVisibleItemBySlug: (slug) => visibleItemsBySlug.get(slug) ?? null,
    getVisibleAncestors: (itemId) => getVisibleAncestors(itemId, visibleItemsById),
    queryVisibleItems: (input) => queryVisibleItems(visibleItems, input),
  }
}

function snapshotCatalogItem(item: AnyItem): AnyItem {
  return freezeCatalogSnapshot(structuredClone(item)) as AnyItem
}

function freezeCatalogSnapshot<T>(value: T, seen = new WeakSet<object>()): T {
  if (typeof value !== 'object' || value === null) return value
  if (seen.has(value)) return value

  seen.add(value)
  for (const nestedValue of Object.values(value)) {
    freezeCatalogSnapshot(nestedValue, seen)
  }

  return Object.freeze(value)
}

function getVisibleAncestors(
  itemId: SidebarItemId,
  visibleItemsById: ReadonlyMap<SidebarItemId, AnyItem>,
) {
  const item = visibleItemsById.get(itemId)
  if (!item) return []

  const ancestors: Array<AnyItem> = []
  const seen = new Set([item.id])
  let parentId = item.parentId

  while (parentId && !seen.has(parentId)) {
    const parent = visibleItemsById.get(parentId)
    if (!parent) break
    ancestors.unshift(parent)
    seen.add(parent.id)
    parentId = parent.parentId
  }

  return ancestors
}

function queryVisibleItems(
  visibleItems: ReadonlyArray<AnyItem>,
  input: FileSystemCatalogVisibleItemsInput = {},
) {
  // Distinguish no parent filter from an explicit root filter with parentId: null.
  const hasParentFilter = Object.prototype.hasOwnProperty.call(input, 'parentId')
  const types =
    input.type === undefined ? null : new Set(Array.isArray(input.type) ? input.type : [input.type])

  return visibleItems.filter((item) => {
    if (hasParentFilter && item.parentId !== input.parentId) return false
    return types ? types.has(item.type) : true
  })
}

function buildChildrenByParent(
  items: Iterable<AnyItem>,
  itemsById: ReadonlyMap<SidebarItemId, AnyItem>,
) {
  const childrenByParent = new Map<SidebarItemId | null, Array<AnyItem>>()

  for (const item of items) {
    const parentId = item.parentId && !itemsById.has(item.parentId) ? null : item.parentId
    const siblings = childrenByParent.get(parentId)
    if (siblings) {
      siblings.push(item)
    } else {
      childrenByParent.set(parentId, [item])
    }
  }

  return childrenByParent
}

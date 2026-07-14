import type { ResourceId } from '../resources/domain-id'
import type { BlockSearchResult } from '../../../../shared/search/types'
import type { AnyItem } from '../workspace/items'
import type { ResourceSlug } from '../workspace/resource-contract'
import type { ItemSearchInput, ItemSearchResult, ItemSearchState } from '../search/model'
import {
  buildItemSearchResults,
  formatItemAncestorBreadcrumb,
  toItemSearchResult,
} from '../search/model'
import { createFileSystemCatalogIndex } from './catalog-index'
import type { FileSystemCatalogVisibleItemsInput } from './catalog-index'
import { createFileSystemPaths } from './catalog-paths'
import { normalizeSelectedRoots } from './domain/selection-roots'
import type { FileSystemSearch, ItemLinksCapability } from './search'

export interface ResourceCatalog {
  getKnownItemById: (itemId: ResourceId) => AnyItem | null
  getKnownItemBySlug: (slug: ResourceSlug) => AnyItem | null
  getVisibleItemById: (itemId: ResourceId) => AnyItem | null
  getVisibleItemBySlug: (slug: ResourceSlug) => AnyItem | null
  getVisibleAncestors: (itemId: ResourceId) => ReadonlyArray<AnyItem>
  getVisibleItems: () => ReadonlyArray<AnyItem>
  getVisibleRoots: () => ReadonlyArray<AnyItem>
  getTrashedItems: () => ReadonlyArray<AnyItem>
  getTrashedRoots: () => ReadonlyArray<AnyItem>
  getVisibleChildren: (parentId: ResourceId | null) => ReadonlyArray<AnyItem>
  getTrashedChildren: (parentId: ResourceId | null) => ReadonlyArray<AnyItem>
  queryVisibleItems: (input?: FileSystemCatalogVisibleItemsInput) => ReadonlyArray<AnyItem>
}

interface ResourceOperationItemsInput {
  itemIds: ReadonlyArray<ResourceId>
  excludeItemIds?: ReadonlyArray<ResourceId>
  includeTrashed?: boolean
}

export interface ResourceOperationItems {
  resolveItems: (input: ResourceOperationItemsInput) => Array<AnyItem>
}

interface CatalogFileSystemSearchInput {
  catalog: ResourceCatalog
  itemLinks: ItemLinksCapability
  ensureSearchState: (input: ItemSearchInput) => void
  getSearchBodyState: (input: ItemSearchInput) => {
    bodyResults?: Array<BlockSearchResult>
    bodySearchError: unknown
    bodySearchPending: boolean
  }
  recentItems?: Array<ItemSearchResult>
}

export function createResourceCatalogModel({
  activeItems,
  trashItems,
  visibleActiveItems = activeItems,
}: {
  activeItems: Array<AnyItem>
  trashItems: Array<AnyItem>
  visibleActiveItems?: Array<AnyItem>
}) {
  const index = createFileSystemCatalogIndex({
    activeItems,
    trashItems,
    visibleActiveItems,
  })

  const catalog: ResourceCatalog = {
    getKnownItemById: index.getKnownItemById,
    getKnownItemBySlug: index.getKnownItemBySlug,
    getVisibleItemById: index.getVisibleItemById,
    getVisibleItemBySlug: index.getVisibleItemBySlug,
    getVisibleAncestors: index.getVisibleAncestors,
    getVisibleItems: () => [...index.visibleItems],
    getVisibleRoots: () => [...index.visibleRoots],
    getTrashedItems: () => [...index.trashedItems],
    getTrashedRoots: () => [...index.trashRoots],
    getVisibleChildren: (parentId) => [...(index.visibleChildrenByParent.get(parentId) ?? [])],
    getTrashedChildren: (parentId) => [...(index.trashChildrenByParent.get(parentId) ?? [])],
    queryVisibleItems: (input) => [...index.queryVisibleItems(input)],
  }
  return {
    catalog,
    operationItems: createResourceOperationItems({
      getKnownItemById: index.getKnownItemById,
    }),
    paths: createFileSystemPaths(index),
  }
}

function createResourceOperationItems({
  getKnownItemById,
}: {
  getKnownItemById: (itemId: ResourceId) => AnyItem | null
}): ResourceOperationItems {
  return {
    resolveItems: (input) => resolveResourceOperationItems(input, { getKnownItemById }),
  }
}

function resolveResourceOperationItems(
  { itemIds, excludeItemIds = [], includeTrashed = true }: ResourceOperationItemsInput,
  { getKnownItemById }: { getKnownItemById: (itemId: ResourceId) => AnyItem | null },
) {
  const excluded = new Set(excludeItemIds)
  const seen = new Set<ResourceId>()
  const itemsById = new Map<ResourceId, AnyItem>()
  const items: Array<AnyItem> = []

  const rememberKnownItem = (itemId: ResourceId) => {
    const existing = itemsById.get(itemId)
    if (existing) return existing
    const item = getKnownItemById(itemId)
    if (item) itemsById.set(itemId, item)
    return item
  }

  const rememberKnownAncestors = (item: AnyItem) => {
    let parentId = item.parentId
    const ancestorsSeen = new Set<ResourceId>()
    while (parentId) {
      if (ancestorsSeen.has(parentId)) break
      ancestorsSeen.add(parentId)
      const parent = rememberKnownItem(parentId)
      if (!parent) break
      parentId = parent.parentId
    }
  }

  for (const itemId of itemIds) {
    if (excluded.has(itemId) || seen.has(itemId)) continue
    seen.add(itemId)
    const item = rememberKnownItem(itemId)
    if (!item || (!includeTrashed && item.isTrashed)) continue
    items.push(item)
    rememberKnownAncestors(item)
  }

  return normalizeSelectedRoots(items, itemsById)
}

export function createCatalogFileSystemSearch({
  catalog,
  ensureSearchState,
  getSearchBodyState,
  itemLinks,
  recentItems = [],
}: CatalogFileSystemSearchInput): Extract<FileSystemSearch, { status: 'available' }> {
  return {
    status: 'available',
    ensureSearchState,
    getSearchState: (input) => {
      const bodyState = getSearchBodyState(input)
      return createCatalogItemSearchState({
        bodyResults: bodyState.bodyResults,
        bodySearchError: bodyState.bodySearchError,
        bodySearchPending: bodyState.bodySearchPending,
        catalog,
        query: input.query,
        recentItems,
      })
    },
    itemLinks,
  }
}

function getCatalogItemBreadcrumb(catalog: ResourceCatalog, item: AnyItem): string {
  return formatItemAncestorBreadcrumb(catalog.getVisibleAncestors(item.id))
}

export function createCatalogItemSearchResult(
  catalog: ResourceCatalog,
  item: AnyItem,
): ItemSearchResult {
  return toItemSearchResult(item, (candidate) => getCatalogItemBreadcrumb(catalog, candidate))
}

function createCatalogItemSearchState({
  bodyResults,
  bodySearchError,
  bodySearchPending,
  catalog,
  query,
  recentItems,
}: {
  bodyResults?: Array<BlockSearchResult>
  bodySearchError: unknown
  bodySearchPending: boolean
  catalog: ResourceCatalog
  query: string
  recentItems: Array<ItemSearchResult>
}): ItemSearchState {
  const items = [...catalog.queryVisibleItems()]
  const getBreadcrumb = (item: AnyItem) => getCatalogItemBreadcrumb(catalog, item)
  return {
    bodySearchError,
    bodySearchPending,
    recentItems,
    results: buildItemSearchResults({
      bodyResults,
      getBreadcrumb,
      items,
      query,
    }),
  }
}
